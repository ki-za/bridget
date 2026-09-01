# Final zoom profiling

## Symptom: “the final zoom drops a frame”

Search for `final-zoom-image-raster`. The active asset is square, but a regression can
make its composited layer viewport-wide. Chromium then discovers too many
high-resolution tiles in the last part of the scale animation and presents the final
frame late.

Run the cold-cache, 2322×1010 compositor check:

```sh
PROFILE_FINAL_ZOOM=1 pnpm exec playwright test tests/e2e/final-zoom-profile.spec.ts
```

The command prints a JSON summary and saves `final-zoom-trace.json` in that test's
reported output directory. A healthy run has:

- `maxFrameIntervalMs` below 20 ms;
- no more than 40 post-completion raster tasks (square image plus atomic panel reveal);
- less than 30 ms total post-completion raster worker time; and
- `rasterSettledMs` below 40 ms.

The frame interval and raster-task count are the primary regression signals. Individual
`RasterTask` durations are worker-CPU time and vary with shared orb load, so their
bounds intentionally allow that noise while still rejecting work that does not settle
promptly.

If `postCompletionRasterTasks` grows, first inspect the `.stage img` box: its width and
height must remain equal. In the trace, search `RasterTask` and compare its `layerId`
with `UpdateLayer`; repeated high-resolution work on the active image is the failure.

If the image layer is square but `rasterSettledMs` is high, search
`final-zoom-panel-raster`: verify `.image-info-container` exists during
`opening-with-info`, the same node survives into `expanded-with-info`, and
`.panel-container` retains `will-change: opacity`. During opening, `preparing` must
give the panel `opacity: 0`, and the container must be `inert` and `aria-hidden` so
real links cannot flash or receive input. A newly mounted panel moves layout, paint,
and tile preparation back onto the final frame.

Do not stop the trace at the `zoom-expanded` state change. Keep at least 100 ms after
that marker so delayed paint, tile preparation, sync-tree activation, and draw work
remain visible.

## High-resolution loading policy

Opening assigns the high-resolution URL only to the selected image and waits for its
`decode()` promise before movement begins. On a cold cache, the cursor can therefore
show genuine loading while the image remains stationary instead of letting decode work
interrupt the fade, center, or zoom choreography. Once the slideshow is stable, it
preloads the previous image after 150 ms and the next image after another 150 ms.
Closing or navigating cancels that queue; navigation immediately prioritizes the
requested image instead.

If only the first opening stutters, compare cold and warm traces before changing the
timeline. A large first-only `ImageDecodeTask` or layout cost is cache warm-up, not a
late adjacent-image request. Verify the selected image stays stationary until decode
completes; do not eagerly preload the entire collection, because that makes memory and
network contention grow with gallery size.

Do not diagnose `final-zoom-image-raster` as a network batching problem unless a trace
shows `ResourceSendRequest` during the zoom. The original three-image batch completed
about 1.7 seconds before the final scale segment; its end-of-animation `ImageDecodeTask`
events belonged to compositor tiles for the active image, not late adjacent downloads.
