import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
  type JSX
} from 'solid-js'

import type { ImageInfo } from '../resources'
import { toArray } from '../resources'

interface HitAreaSegment {
  height: number
  top: number
  width: number
}

const hitAreaSelector = [
  '.tags-wrapper',
  '.project-header',
  '.artist-section',
  '.project-links',
  '.track-list',
  '.metadata-section'
].join(', ')

export default function ImageInfoPanel(props: { info?: ImageInfo }): JSX.Element {
  let panel: HTMLDivElement | undefined
  let resizeObserver: ResizeObserver | undefined
  let updateFrame: number | undefined
  const [hitAreaSegments, setHitAreaSegments] = createSignal<HitAreaSegment[]>([])

  const updateHitAreaSegments = (): void => {
    updateFrame = undefined
    if (panel === undefined || props.info === undefined) {
      setHitAreaSegments([])
      return
    }

    const panelBox = panel.getBoundingClientRect()
    if (panelBox.width === 0 || panelBox.height === 0) return

    const scaleX = panel.clientWidth / panelBox.width
    const scaleY = panel.clientHeight / panelBox.height
    const targets = Array.from(panel.querySelectorAll<HTMLElement>(hitAreaSelector))
    const spine = panel.querySelector<HTMLElement>('.image-info-hit-spine')
    if (targets.length === 0 || spine === null) return
    const hitPadding = Number.parseFloat(getComputedStyle(panel).paddingLeft) || 0

    resizeObserver?.observe(panel)
    targets.forEach((target) => resizeObserver?.observe(target))

    const blocks = targets.map((target) => {
      const box = target.getBoundingClientRect()
      return {
        bottom: Math.min(
          panel.clientHeight,
          (box.bottom - panelBox.top) * scaleY + hitPadding
        ),
        right: Math.min(
          panel.clientWidth,
          (box.right - panelBox.left) * scaleX + hitPadding
        ),
        top: Math.max(0, (box.top - panelBox.top) * scaleY - hitPadding)
      }
    })
    const spineBox = spine.getBoundingClientRect()
    const spineWidth = Math.min(
      panel.clientWidth,
      (spineBox.right - panelBox.left) * scaleX
    )
    const boundaries = [
      0,
      panel.clientHeight,
      ...blocks.flatMap(({ bottom, top }) => [bottom, top])
    ]
      .map((value) => Math.round(value * 100) / 100)
      .filter((value, index, values) => values.indexOf(value) === index)
      .sort((left, right) => left - right)

    // Fill each vertical slice between its highest and lowest protected content.
    const segments: HitAreaSegment[] = []
    for (let index = 0; index < boundaries.length - 1; index += 1) {
      const top = boundaries[index]
      const bottom = boundaries[index + 1]
      if (bottom - top < 0.5) continue

      const middle = (top + bottom) / 2
      const widestAbove = Math.max(
        spineWidth,
        ...blocks.filter((block) => block.top <= middle).map((block) => block.right)
      )
      const widestBelow = Math.max(
        spineWidth,
        ...blocks.filter((block) => block.bottom >= middle).map((block) => block.right)
      )
      const width = Math.min(widestAbove, widestBelow)
      const previous = segments.at(-1)
      if (previous !== undefined && Math.abs(previous.width - width) < 0.5) {
        previous.height = bottom - previous.top
      } else {
        segments.push({ height: bottom - top, top, width })
      }
    }
    setHitAreaSegments(segments)
  }

  const scheduleHitAreaUpdate = (): void => {
    if (updateFrame !== undefined) cancelAnimationFrame(updateFrame)
    updateFrame = requestAnimationFrame(updateHitAreaSegments)
  }

  createEffect(() => {
    if (props.info === undefined) {
      setHitAreaSegments([])
      return
    }
    scheduleHitAreaUpdate()
  })

  onMount(() => {
    resizeObserver = new ResizeObserver(scheduleHitAreaUpdate)
    scheduleHitAreaUpdate()
  })

  onCleanup(() => {
    resizeObserver?.disconnect()
    if (updateFrame !== undefined) cancelAnimationFrame(updateFrame)
  })

  return (
    <Show when={props.info}>
      {(info) => {
        const artistNames = createMemo(() => toArray(info().artistName))
        const artistLinks = createMemo(() => toArray(info().artistLink))
        const releasedByLinks = createMemo(() => toArray(info().releasedByLink))
        const collaboratorLinks = createMemo(() => toArray(info().collaboratorLinks))

        return (
          <div class="panel-container">
            <div class="image-info-panel" ref={panel}>
              <div class="image-info-hit-layer" aria-hidden="true">
                <For each={hitAreaSegments()}>
                  {(segment) => (
                    <div
                      class="image-info-hit-segment"
                      style={{
                        height: `${segment.height}px`,
                        top: `${segment.top}px`,
                        width: `${segment.width}px`
                      }}
                    />
                  )}
                </For>
              </div>
              <div class="image-info-hit-spine" aria-hidden="true" />

              <Show when={info().projectContributionTags?.length}>
                <section class="contribution-tags">
                  <div class="tags-wrapper">
                    <For each={info().projectContributionTags}>
                      {(tag) => (
                        <span class="tag" data-tag={tag}>
                          {tag}
                        </span>
                      )}
                    </For>
                  </div>
                </section>
              </Show>

              <Show when={info().projectName}>
                <div class="project-header">
                  <h3 class="project-name">{info().projectName}</h3>
                </div>
              </Show>

              <div class="artist-section">
                <Show when={info().releaseYear}>
                  <p class="release-year">{info().releaseYear}</p>
                </Show>
                <h2 class="artist-name">
                  <For each={artistNames()}>
                    {(name, index) => (
                      <>
                        <Show when={artistLinks()[index()]} fallback={<>{name}</>}>
                          <a
                            href={artistLinks()[index()]}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {name}
                          </a>
                        </Show>
                        <Show when={index() < artistNames().length - 1}>{', '}</Show>
                      </>
                    )}
                  </For>
                </h2>
              </div>

              <Show when={info().spotifyLink || info().appleMusicLink}>
                <div class="project-links">
                  <Show when={info().spotifyLink}>
                    <a
                      href={info().spotifyLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="link-button link-icon"
                    >
                      Spotify
                    </a>
                  </Show>
                  <Show when={info().appleMusicLink}>
                    <a
                      href={info().appleMusicLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="link-button link-icon"
                    >
                      Apple Music
                    </a>
                  </Show>
                </div>
              </Show>

              <div class="section-divider" />

              <div class="content-constrained">
                <Show when={info().trackList?.length}>
                  <section class="track-list">
                    <h4 class="track-section-label">Tracks</h4>
                    <div class="track-items">
                      <For each={info().trackList}>
                        {(track) => (
                          <>
                            <div class="track-item">
                              <span class="track-name">{track.name}</span>
                              <Show when={track.contributionTags?.length}>
                                <div class="track-tags">
                                  <For each={track.contributionTags}>
                                    {(tag) => (
                                      <span class="tag" data-tag={tag}>
                                        <span class="tag-label">{tag}</span>
                                      </span>
                                    )}
                                  </For>
                                </div>
                              </Show>
                            </div>
                          </>
                        )}
                      </For>
                    </div>
                  </section>
                </Show>

                <Show when={info().trackList?.length}>
                  <div class="section-divider" />
                </Show>

                <Show when={info().collaborators?.length || info().releasedBy?.length}>
                  <section class="metadata-section">
                    <Show when={info().collaborators?.length}>
                      <div class="collaborator-list">
                        <h4 class="section-label">Collaborated:</h4>
                        <For each={info().collaborators}>
                          {(collaborator, index) => (
                            <>
                              <Show
                                when={collaboratorLinks()[index()]}
                                fallback={
                                  <span class="collaborator">{collaborator}</span>
                                }
                              >
                                <a
                                  href={collaboratorLinks()[index()]}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  class="collaborator"
                                >
                                  {collaborator}
                                </a>
                              </Show>
                              <Show when={index() < info().collaborators!.length - 1}>
                                {', '}
                              </Show>
                            </>
                          )}
                        </For>
                      </div>
                    </Show>

                    <Show when={info().releasedBy?.length}>
                      <div class="released-by">
                        <h4 class="section-label">Released by:</h4>
                        <For each={info().releasedBy}>
                          {(publisher, index) => (
                            <>
                              <Show
                                when={releasedByLinks()[index()]}
                                fallback={<span>{publisher}</span>}
                              >
                                <a
                                  href={releasedByLinks()[index()]}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {publisher}
                                </a>
                              </Show>
                              <Show when={index() < info().releasedBy!.length - 1}>
                                {', '}
                              </Show>
                            </>
                          )}
                        </For>
                      </div>
                    </Show>
                  </section>
                </Show>
              </div>
            </div>
          </div>
        )
      }}
    </Show>
  )
}
