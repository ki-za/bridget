# Desktop interaction matrix

The gallery is tested as a state machine. Every transition must preserve the listed visual
invariants; a test passing only from a fresh page is not sufficient.

| Start state         | Interaction                       | End state                                       | Required invariant                                                                            | Automated coverage           |
| ------------------- | --------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------- |
| Blank stage         | Resize                            | Blank stage                                     | No image becomes visible                                                                      | Resize lifecycle             |
| Blank stage         | Move pointer                      | Trail                                           | One image appears per threshold crossing, capped by trail and collection length               | Threshold permutations       |
| Trail (1 image)     | Open                              | Slideshow                                       | The sole image enlarges without a blank frame                                                 | Repeated lifecycle           |
| Trail (many images) | Open                              | Slideshow                                       | Oldest images fade first; the front image does not move or scale until the others are gone    | Frame-level opening sequence |
| Slideshow           | Next                              | Slideshow                                       | Old and new images crossfade in the same geometry; the stage never goes blank                 | Frame-level navigation       |
| Slideshow           | Previous                          | Slideshow                                       | Same invariant as Next                                                                        | Repeated lifecycle           |
| Slideshow           | Repeated input during a crossfade | Slideshow                                       | Only the accepted transition runs; stale transitions cannot finish later                      | Input serialization          |
| Slideshow           | Arrow keys / Escape               | Slideshow / Trail                               | Keyboard and pointer controls use the same guarded transitions                                | Input serialization          |
| Slideshow           | Navigate past either end          | Slideshow                                       | Index wraps without stale images                                                              | Navigation permutations      |
| Slideshow           | Close                             | Trail                                           | Current image shrinks first, then returns to its saved pointer position; no old trail returns | Frame-level closing sequence |
| Trail after close   | Move pointer                      | Trail                                           | New images extend the one-image trail; hidden images do not reappear                          | Repeated lifecycle           |
| Trail after close   | Reopen                            | Slideshow                                       | The new front image opens; no image from an earlier cycle appears                             | Repeated lifecycle           |
| Any animation phase | Resize                            | Same logical phase or its completed destination | One coherent image state; no stale transform or opacity                                       | Resize lifecycle             |
| Info collection     | Navigate                          | Slideshow                                       | Metadata remains paired with the visible image; links remain interactive                      | Frame-level navigation       |
| Plain collection    | Open, navigate, close             | Corresponding state                             | Centered image behavior works without an info panel                                           | Collection permutations      |

Trail settings are tested at every configured threshold: 20/20, 40/10, 80/5, 140/5,
and 200/5 (distance/trail length). The 20-image trail is capped by the 14-image demo
collection, proving that a collection shorter than the configured trail does not reuse one DOM
image in multiple positions.
