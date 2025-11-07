import { For, Show, type JSX } from 'solid-js'
import type { ImageInfo } from '../resources'

export default function ImageInfoPanel(props: {
  info: ImageInfo | null | undefined
}): JSX.Element {
  // If missing -> null UI. No ghost component in the DOM.

  return (
    <Show when={props.info}>
      {(info) => (
        <div class="image-info-panel">
          <div class="artist-section">
            <h2 class="artist-name">
              <Show when={info().artistLink} fallback={info().artistName}>
                <a href={info().artistLink!} target="_blank" rel="noopener noreferrer">
                  {info().artistName}
                </a>
              </Show>
            </h2>

            <Show when={info().projectName}>
              <h3 class="project-name">{info().projectName}</h3>
            </Show>

            <Show when={info().releaseYear}>
              <p class="release-year">{info().releaseYear}</p>
            </Show>
          </div>

          <Show when={info().projectContributionTags?.length}>
            <section class="contribution-tags">
              <h4>Contribution</h4>
              <For each={info().projectContributionTags!}>
                {(tag) => <span class="tag">{tag}</span>}
              </For>
            </section>
          </Show>

          <Show when={info().trackList?.length}>
            <section class="track-list">
              <h4>Tracks</h4>
              <For each={info().trackList!}>
                {(track) => (
                  <div class="track-item">
                    <span class="track-name">{track.name}</span>
                    <Show when={track.contributionTags?.length}>
                      <div class="track-tags">
                        <For each={track.contributionTags!}>
                          {(tag) => <span class="tag">{tag}</span>}
                        </For>
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </section>
          </Show>

          <section class="links-section">
            <Show when={info().spotifyLink}>
              <a href={info().spotifyLink!} target="_blank" rel="noopener noreferrer">
                Spotify
              </a>
            </Show>
            <Show when={info().appleMusicLink}>
              <a
                href={info().appleMusicLink!}
                target="_blank"
                rel="noopener noreferrer"
              >
                Apple Music
              </a>
            </Show>
          </section>

          <Show when={info().collaborators?.length || info().releasedBy?.length}>
            <section class="collaborators">
              <Show when={info().releasedBy?.length}>
                <div class="released-by">
                  <h4>Released by</h4>
                  <For each={info().releasedBy!}>
                    {(publisher) => (
                      <Show when={info().releasedByLink} fallback={publisher}>
                        <a
                          href={info().releasedByLink!}
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

              <Show when={info().collaborators?.length}>
                <div class="collaborator-list">
                  <h4>Collaborators</h4>
                  <For each={info().collaborators!}>{(c) => <span>{c}</span>}</For>
                </div>
              </Show>
            </section>
          </Show>
        </div>
      )}
    </Show>
  )
}
