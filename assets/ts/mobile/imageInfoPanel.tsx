import { createMemo, createSignal, For, Show, type JSX } from 'solid-js'

import type { ImageInfo } from '../resources'
import { toArray } from '../resources'

export default function MobileImageInfoPanel(props: { info?: ImageInfo }): JSX.Element {
  const [showTrackModal, setShowTrackModal] = createSignal(false)

  const openTrackModal = () => {
    setShowTrackModal(true)
    document.body.style.overflow = 'hidden'
  }

  const closeTrackModal = () => {
    setShowTrackModal(false)
    document.body.style.overflow = ''
  }

  return (
    <Show when={props.info}>
      {(info) => {
        const artistNames = createMemo(() => toArray(info().artistName))
        const artistLinks = createMemo(() => toArray(info().artistLink))
        const releasedByLinks = createMemo(() => toArray(info().releasedByLink))

        return (
          <>
            <div class="mobile-image-info">
              {/* Contribution Tags */}
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

              {/* Project Header with Inline Links */}
              <div class="project-header">
                <div class="project-title-wrapper">
                  {/* Project Name */}
                  <Show when={info().projectName}>
                    <h2 class="project-name">{info().projectName}</h2>
                  </Show>

                  {/* Artist Name & Year */}
                  <div class="artist-section">
                    <h3 class="artist-name">
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
                            <Show when={index() < artistNames().length - 1}>
                              {', '}
                            </Show>
                          </>
                        )}
                      </For>
                    </h3>
                    <Show when={info().releaseYear}>
                      <span class="release-year"> · {info().releaseYear}</span>
                    </Show>
                  </div>
                </div>

                {/* Links on Right Side */}
                <Show when={info().spotifyLink || info().appleMusicLink}>
                  <div class="external-links">
                    <Show when={info().spotifyLink}>
                      <a
                        href={info().spotifyLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="link-button"
                      >
                        Spotify
                      </a>
                    </Show>
                    <Show when={info().appleMusicLink}>
                      <a
                        href={info().appleMusicLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="link-button"
                      >
                        Apple Music
                      </a>
                    </Show>
                  </div>
                </Show>
              </div>

              {/* Track List - show max 3 */}
              <Show when={info().trackList?.length}>
                <section class="track-list">
                  <h4 class="section-label">Tracks</h4>
                  <div class="track-items">
                    <For each={info().trackList}>
                      {(track) => (
                        <div class="track-item">
                          <span class="track-name">{track.name}</span>
                        </div>
                      )}
                    </For>
                  </div>
                </section>
              </Show>

              {/* Collaborators */}
              <Show when={info().collaborators?.length}>
                <section class="metadata-item">
                  <h4 class="section-label">Collaborated with:</h4>
                  <p class="metadata-value">
                    <For each={info().collaborators}>
                      {(collaborator, index) => (
                        <>
                          <span>{collaborator}</span>
                          <Show when={index() < info().collaborators!.length - 1}>
                            {', '}
                          </Show>
                        </>
                      )}
                    </For>
                  </p>
                </section>
              </Show>

              {/* Released By */}
              <Show when={info().releasedBy?.length}>
                <section class="metadata-item">
                  <h4 class="section-label">Released by:</h4>
                  <p class="metadata-value">
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
                  </p>
                </section>
              </Show>
            </div>

            {/* Track Modal */}
            <Show when={showTrackModal()}>
              <div class="track-modal-overlay" onClick={closeTrackModal}>
                <div class="track-modal" onClick={(e) => e.stopPropagation()}>
                  <div class="track-modal-header">
                    <div class="track-modal-handle" />
                    <h3 class="track-modal-title">
                      All Tracks ({info().trackList?.length})
                    </h3>
                  </div>

                  <div class="track-modal-content">
                    <For each={info().trackList}>
                      {(track, index) => (
                        <div class="track-modal-item">
                          <span class="track-modal-number">{index() + 1}.</span>
                          <div class="track-modal-info">
                            <span class="track-modal-name">{track.name}</span>
                            <Show when={track.contributionTags?.length}>
                              <div class="track-modal-tags">
                                <For each={track.contributionTags}>
                                  {(tag) => (
                                    <span class="tag" data-tag={tag}>
                                      {tag}
                                    </span>
                                  )}
                                </For>
                              </div>
                            </Show>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </div>
            </Show>
          </>
        )
      }}
    </Show>
  )
}
