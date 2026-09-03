import { createEffect, on, onCleanup, onMount, type JSX } from 'solid-js'

import type { TrackInfo } from './resources'

const minimumThumbHeight = 20

export default function TrackScrollbar(props: { tracks?: TrackInfo[] }): JSX.Element {
  let indicator!: HTMLSpanElement
  let mutationObserver: MutationObserver | undefined
  let resizeObserver: ResizeObserver | undefined
  let scrollContainer: HTMLElement | undefined
  let updateFrame: number | undefined

  const update = (): void => {
    updateFrame = undefined
    if (scrollContainer === undefined) return

    // Exclude the absolutely positioned indicator from the overflow measurement.
    indicator.style.height = '0'
    indicator.style.transform = ''

    const { clientHeight, scrollHeight, scrollTop } = scrollContainer
    const scrollRange = scrollHeight - clientHeight
    const isScrollable = clientHeight > 0 && scrollRange > 1
    indicator.classList.toggle('track-scrollbar--visible', isScrollable)

    if (!isScrollable) return

    const thumbHeight = Math.max(
      minimumThumbHeight,
      (clientHeight * clientHeight) / scrollHeight
    )
    const thumbOffset = (scrollTop / scrollRange) * (clientHeight - thumbHeight)

    indicator.style.height = `${thumbHeight}px`
    indicator.style.transform = `translateY(${scrollTop + thumbOffset}px)`
  }

  const scheduleUpdate = (): void => {
    if (updateFrame !== undefined) return
    updateFrame = requestAnimationFrame(update)
  }

  createEffect(on(() => props.tracks, scheduleUpdate))

  onMount(() => {
    scrollContainer = indicator.parentElement ?? undefined
    if (scrollContainer === undefined) return

    resizeObserver = new ResizeObserver(scheduleUpdate)

    const observeSizes = (): void => {
      resizeObserver?.disconnect()
      resizeObserver?.observe(scrollContainer!)
      scrollContainer
        ?.querySelectorAll<HTMLElement>('.track-item')
        .forEach((track) => resizeObserver?.observe(track))
    }

    mutationObserver = new MutationObserver(() => {
      observeSizes()
      scheduleUpdate()
    })
    mutationObserver.observe(scrollContainer, {
      characterData: true,
      childList: true,
      subtree: true
    })
    scrollContainer.addEventListener('scroll', scheduleUpdate, { passive: true })
    observeSizes()
    scheduleUpdate()
  })

  onCleanup(() => {
    mutationObserver?.disconnect()
    resizeObserver?.disconnect()
    scrollContainer?.removeEventListener('scroll', scheduleUpdate)
    if (updateFrame !== undefined) cancelAnimationFrame(updateFrame)
  })

  return <span ref={indicator} class="track-scrollbar" aria-hidden="true" />
}
