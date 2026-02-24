import { For, Show, type JSX } from 'solid-js'

import type { ImageInfo } from '../resources'

export default function ImageInfoPanel(props: { info?: ImageInfo }): JSX.Element {
  return (
    <Show when={props.info}>
      {(info) => (
        <div class="panel-container">
          <div class="image-info-panel">
            {/* Contribution Tags Section */}
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

            {/* Project Header Section */}
            <Show when={info().projectName}>
              <div class="project-header">
                <h3 class="project-name">{info().projectName}</h3>
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
              </div>
            </Show>

            {/* Artist Section */}
            <div class="artist-section">
              <Show when={info().releaseYear}>
                <p class="release-year">{info().releaseYear}</p>
              </Show>

              <h2 class="artist-name">
                <Show when={info().artistLink} fallback={<>{info().artistName}</>}>
                  <a href={info().artistLink} target="_blank" rel="noopener noreferrer">
                    {info().artistName}
                  </a>
                </Show>
              </h2>
            </div>

            <div class="section-divider" />

            {/* Content Constrained Wrapper */}
            <div class="content-constrained">
              {/* Track List Section */}
              <Show when={info().trackList?.length}>
                <section class="track-list">
                  <h4 class="track-section-label">Tracks</h4>
                  <div class="track-items">
                    <For each={info().trackList}>
                      {(track, index) => (
                        <>
                          <div class="track-item">
                            <span class="track-name">{track.name}</span>
                            <Show when={track.contributionTags?.length}>
                              <div class="track-tags">
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
                          {/* <Show when={index() < info().trackList!.length - 1}> */}
                          {/*   <div class="track-divider"></div> */}
                          {/* </Show> */}
                        </>
                      )}
                    </For>
                  </div>
                </section>
              </Show>

              <Show when={info().trackList?.length}>
                <div class="section-divider" />
              </Show>

              {/* Metadata Section (Collaborators & Released By) */}
              <Show when={info().collaborators?.length || info().releasedBy?.length}>
                <section class="metadata-section">
                  {/* Collaborators */}
                  <Show when={info().collaborators?.length}>
                    <div class="collaborator-list">
                      <h4 class="section-label">Collaborated:</h4>
                      <For each={info().collaborators}>
                        {(collaborator, index) => (
                          <>
                            <span class="collaborator">{collaborator}</span>
                            <Show when={index() < info().collaborators!.length - 1}>
                              {', '}
                            </Show>
                          </>
                        )}
                      </For>
                    </div>
                  </Show>

                  {/* Released By */}
                  <Show when={info().releasedBy?.length}>
                    <div class="released-by">
                      <h4 class="section-label">Released by:</h4>
                      <For each={info().releasedBy}>
                        {(publisher) => (
                          <Show
                            when={info().releasedByLink}
                            fallback={<span>{publisher}</span>}
                          >
                            <a
                              href={info().releasedByLink}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {publisher}
                            </a>
                          </Show>
                        )}
                      </For>
                    </div>
                  </Show>
                </section>
              </Show>
            </div>
          </div>
        </div>
      )}
    </Show>
  )
}
