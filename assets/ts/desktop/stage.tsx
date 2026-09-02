import { type gsap } from 'gsap'
import {
  For,
  Show,
  createEffect,
  createSignal,
  on,
  onCleanup,
  onMount,
  type Accessor,
  type JSX,
  type Setter
} from 'solid-js'

import type { ImageInfo, ImageJSON } from '../resources'
import { useState, type State } from '../state'
import { decrement, increment, loadGsap, type Vector } from '../utils'

import ImageInfoPanel from './imageInfoPanel'
import type { DesktopImage, HistoryItem } from './layout'

/**
 * helper functions
 */

function getTrailElsIndex(cordHistValue: HistoryItem[]): number[] {
  return cordHistValue.map((el) => el.i)
}

function getTrailCurrentElsIndex(
  cordHistValue: HistoryItem[],
  stateValue: State
): number[] {
  return getTrailElsIndex(cordHistValue).slice(-stateValue.trailLength)
}

function getTrailInactiveElsIndex(
  cordHistValue: HistoryItem[],
  stateValue: State
): number[] {
  return getTrailCurrentElsIndex(cordHistValue, stateValue).slice(0, -1)
}

function getCurrentElIndex(cordHistValue: HistoryItem[]): number {
  return getTrailElsIndex(cordHistValue).slice(-1)[0]
}

function getPrevElIndex(cordHistValue: HistoryItem[], stateValue: State): number {
  return decrement(cordHistValue.slice(-1)[0].i, stateValue.length)
}

function getNextElIndex(cordHistValue: HistoryItem[], stateValue: State): number {
  return increment(cordHistValue.slice(-1)[0].i, stateValue.length)
}

function getImagesFromIndexes(imgs: DesktopImage[], indexes: number[]): DesktopImage[] {
  return indexes.map((i) => imgs[i])
}

function hires(imgs: DesktopImage[]): void {
  imgs.forEach((img) => {
    if (img.src === img.dataset.hiUrl) return
    img.src = img.dataset.hiUrl
    img.height = parseInt(img.dataset.hiImgH)
    img.width = parseInt(img.dataset.hiImgW)
  })
}

function lores(imgs: DesktopImage[]): void {
  imgs.forEach((img) => {
    if (img.src === img.dataset.loUrl) return
    img.src = img.dataset.loUrl
    img.height = parseInt(img.dataset.loImgH)
    img.width = parseInt(img.dataset.loImgW)
  })
}

function onMutation<T extends HTMLElement>(
  element: T,
  trigger: (arg0: MutationRecord) => boolean,
  observeOptions: MutationObserverInit = { attributes: true }
): MutationObserver {
  const observer = new MutationObserver((mutations, currentObserver) => {
    for (const mutation of mutations) {
      if (trigger(mutation)) {
        currentObserver.disconnect()
        break
      }
    }
  })
  observer.observe(element, observeOptions)
  return observer
}

export type ViewportMode =
  | 'trail'
  | 'opening'
  | 'opening-with-info'
  | 'navigating'
  | 'navigating-with-info'
  | 'expanded'
  | 'expanded-with-info'
  | 'closing'

function getImageTargetTransform(
  imageArea: HTMLDivElement,
  image: HTMLImageElement
): { x: number; scale: number } {
  return {
    x:
      imageArea.offsetLeft +
      imageArea.offsetWidth / 2 -
      (image.offsetLeft + image.offsetWidth / 2),
    scale: imageArea.offsetWidth / image.offsetWidth
  }
}

/**
 * Stage component
 */

export default function Stage(props: {
  ijs: ImageJSON[]
  setIsLoading: Setter<boolean>
  isOpen: Accessor<boolean>
  setIsOpen: Setter<boolean>
  isAnimating: Accessor<boolean>
  setIsAnimating: Setter<boolean>
  cordHist: Accessor<HistoryItem[]>
  setCordHist: Setter<HistoryItem[]>
  navVector: Accessor<Vector>
  setNavVector: Setter<Vector>
  currentImageInfo: Accessor<ImageInfo | undefined>
  mode: ViewportMode
}): JSX.Element {
  // variables
  let _gsap: typeof gsap
  let gsapPromise: Promise<void> | undefined
  let activeTimeline: gsap.core.Timeline | undefined
  let panelFadeTimeline: gsap.core.Timeline | undefined
  let adjacentPreloadTimer: number | undefined
  let resizeFrame: number | undefined
  let stage: HTMLDivElement | undefined
  let imageArea: HTMLDivElement | undefined

  // eslint-disable-next-line solid/reactivity
  const imgs: DesktopImage[] = Array<DesktopImage>(props.ijs.length)
  let last = { x: 0, y: 0 }

  let abortController: AbortController | undefined
  let lifecycleController: AbortController | undefined
  const mutationObservers: MutationObserver[] = []
  let renderedIndexes = new Set<number>()
  let expandedImageIndex: number | undefined

  // states
  let gsapLoaded = false
  const [visibleImageInfo, setVisibleImageInfo] = createSignal<ImageInfo>()
  const [imageInfoOverlaps, setImageInfoOverlaps] = createSignal(false)

  const [state, { incIndex }] = useState()
  const stateLength = state().length

  let mounted = false

  const clearAdjacentPreload = (): void => {
    if (adjacentPreloadTimer === undefined) return
    window.clearTimeout(adjacentPreloadTimer)
    adjacentPreloadTimer = undefined
  }

  const scheduleAdjacentPreload = (
    currentIndex: number,
    adjacentIndexes: [number, number]
  ): void => {
    clearAdjacentPreload()
    const imageIsStillCurrent = (): boolean => {
      const history = props.cordHist()
      return (
        mounted &&
        props.isOpen() &&
        history.length > 0 &&
        getCurrentElIndex(history) === currentIndex
      )
    }
    const preload = (position: number): void => {
      if (!imageIsStillCurrent()) return
      hires([imgs[adjacentIndexes[position]]])
      if (position === 0) {
        adjacentPreloadTimer = window.setTimeout(() => preload(1), 150)
      } else adjacentPreloadTimer = undefined
    }
    // eslint-disable-next-line solid/reactivity
    adjacentPreloadTimer = window.setTimeout(() => preload(0), 150)
  }

  const ensureGsapReady = async (): Promise<void> => {
    if (gsapPromise !== undefined) return await gsapPromise

    gsapPromise = loadGsap()
      .then((g) => {
        _gsap = g
        gsapLoaded = true
      })
      .catch((e) => {
        gsapPromise = undefined
        console.log(e)
      })

    await gsapPromise
  }

  const onMouse: (e: MouseEvent) => void = (e) => {
    if (props.isOpen() || props.isAnimating() || !gsapLoaded || !mounted) return
    const cord = { x: e.clientX, y: e.clientY }
    const travelDist = Math.hypot(cord.x - last.x, cord.y - last.y)

    if (travelDist > state().threshold) {
      last = cord
      incIndex()

      const _state = state()
      const newHist = { i: _state.index, ...cord }
      props.setCordHist((prev) => [...prev, newHist].slice(-stateLength))
    }
  }

  const onClick = async (): Promise<void> => {
    if (!gsapLoaded) await ensureGsapReady()
    if (props.isAnimating() || !gsapLoaded) return
    if (props.cordHist().length === 0) return
    props.setIsOpen(true)
  }

  const setPosition: () => void = () => {
    if (!mounted) return
    if (imgs.length === 0) return
    // if (props.isAnimating()) return
    const _cordHist = props.cordHist()
    const _state = state()
    const visibleHistory = _cordHist.slice(-_state.trailLength)
    const trailElsIndex = getTrailElsIndex(visibleHistory)
    if (trailElsIndex.length === 0) return

    const _isOpen = props.isOpen()
    if (_isOpen && props.navVector() !== 'none') clearAdjacentPreload()
    const elsTrail = getImagesFromIndexes(imgs, trailElsIndex)
    const currentIndex = _isOpen ? getCurrentElIndex(_cordHist) : undefined
    const preservedExpandedImage =
      _isOpen && expandedImageIndex !== undefined ? imgs[expandedImageIndex] : undefined
    const previousExpandedImage =
      currentIndex !== undefined &&
      expandedImageIndex !== undefined &&
      expandedImageIndex !== currentIndex
        ? preservedExpandedImage
        : undefined
    const nextRenderedIndexes = new Set(trailElsIndex)
    const hiddenIndexes = [...renderedIndexes].filter(
      (index) => !nextRenderedIndexes.has(index) && index !== expandedImageIndex
    )
    const hiddenImages = getImagesFromIndexes(imgs, hiddenIndexes)
    if (hiddenImages.length > 0) {
      _gsap.killTweensOf(hiddenImages)
      _gsap.set(hiddenImages, { opacity: 0, zIndex: 0 })
    }
    renderedIndexes = nextRenderedIndexes

    const stageWidth = stage?.clientWidth ?? window.innerWidth
    const stageHeight = stage?.clientHeight ?? window.innerHeight

    // Navigation preserves the established panel geometry. Re-measuring an
    // active overlay against its own overlaid bounds briefly removes the
    // overlay class and makes the panel jump during the image crossfade.
    if (!props.isAnimating() || props.navVector() === 'none') {
      updateImageInfoOverlap()
    }

    const positionedTrail = visibleHistory.filter(
      ({ i }) => imgs[i] !== preservedExpandedImage
    )
    const imagesToPosition = getImagesFromIndexes(
      imgs,
      getTrailElsIndex(positionedTrail)
    )
    _gsap.set(imagesToPosition, {
      x: (i: number) => positionedTrail[i].x - stageWidth / 2,
      y: (i: number) => positionedTrail[i].y - stageHeight / 2,
      zIndex: (i: number) => i,
      scale: 0.6
    })
    const imagesToHide = _isOpen
      ? elsTrail.filter((image) => image !== preservedExpandedImage)
      : elsTrail
    _gsap.killTweensOf(imagesToHide, 'opacity')
    _gsap.set(imagesToHide, { opacity: _isOpen ? 0 : 1 })
    // Expanded modes (with or without info)
    if (_isOpen) {
      if (currentIndex === undefined) return
      const elc = imgs[currentIndex]
      _gsap.set(elc, { zIndex: stateLength + 1 })

      // Preload adjacent images
      const indexArrayToHires: number[] = []
      const indexArrayToCleanup: number[] = []
      switch (props.navVector()) {
        case 'prev':
          indexArrayToHires.push(getPrevElIndex(_cordHist, _state))
          indexArrayToCleanup.push(getNextElIndex(_cordHist, _state))
          break
        case 'next':
          indexArrayToHires.push(getNextElIndex(_cordHist, _state))
          indexArrayToCleanup.push(getPrevElIndex(_cordHist, _state))
          break
        default:
          break
      }

      hires(getImagesFromIndexes(imgs, indexArrayToHires)) // preload
      const imagesToCleanup = getImagesFromIndexes(imgs, indexArrayToCleanup).filter(
        (image) => image !== previousExpandedImage
      )
      if (imagesToCleanup.length > 0) {
        _gsap.killTweensOf(imagesToCleanup)
        _gsap.set(imagesToCleanup, { opacity: 0 })
      }

      // Position current image
      if (
        props.mode === 'expanded-with-info' ||
        props.mode === 'navigating-with-info'
      ) {
        if (imageArea === undefined) throw new Error('missing image area')
        const { x, scale } = getImageTargetTransform(imageArea, elc)
        _gsap.set(elc, { x, y: 0, scale })
      } else {
        _gsap.set(elc, { x: 0, y: 0, scale: 1 })
      }
      expandedImageIndex = currentIndex
      const nextImageInfo = props.currentImageInfo()
      const finishNavigation = props.setIsAnimating
      const navigationComplete =
        props.isAnimating() && props.navVector() !== 'none'
          ? () => finishNavigation(false)
          : undefined
      const updateVisibleInfo =
        navigationComplete === undefined
          ? undefined
          : () => {
              setVisibleImageInfo(nextImageInfo)
            }
      setLoaderForHiresImage(
        elc,
        previousExpandedImage,
        updateVisibleInfo,
        navigationComplete
      )
    } else {
      lores(elsTrail)
    }
  }

  const expandImage = async (): Promise<void> => {
    // isAnimating is prechecked in isOpen effect
    if (!mounted || !gsapLoaded) throw new Error('not mounted or gsap not loaded')

    props.setIsAnimating(true)

    const _cordHist = props.cordHist()
    const _state = state()

    const elcIndex = getCurrentElIndex(_cordHist)
    const elc = imgs[elcIndex]
    const adjacentIndexes: [number, number] = [
      getPrevElIndex(_cordHist, _state),
      getNextElIndex(_cordHist, _state)
    ]
    expandedImageIndex = elcIndex
    setVisibleImageInfo(props.currentImageInfo())
    updateImageInfoOverlap()
    requestAnimationFrame(updateImageInfoOverlap)

    const hasInfo = !!props.currentImageInfo()
    if (hasInfo && imageArea === undefined) throw new Error('missing image area')
    const target =
      hasInfo && imageArea !== undefined
        ? getImageTargetTransform(imageArea, elc)
        : { x: 0, scale: 1 }

    // don't hide here because we want a better transition
    clearAdjacentPreload()
    hires([elc])
    setLoaderForHiresImage(elc)

    // Keep first-use network and decode work out of the movement timeline. The
    // browser retains the decoded image for subsequent openings and navigation.
    await elc.decode().catch(() => undefined)

    // to find out how big the image will be when its enlarged for
    // responsiveness

    activeTimeline?.kill()
    const tl = _gsap.timeline()
    activeTimeline = tl
    const trailInactiveEls = getImagesFromIndexes(
      imgs,
      getTrailInactiveElsIndex(_cordHist, _state)
    )
    _gsap.set(elc, { zIndex: stateLength + 1 })
    if (trailInactiveEls.length > 0) {
      tl.to(trailInactiveEls, {
        y: '+=20',
        ease: 'power3.in',
        stagger: 0.075,
        duration: 0.3,
        delay: 0.1,
        opacity: 0
      })
    }
    tl.to(
      elc,
      {
        x: 0,
        y: 0,
        ease: 'power3.inOut',
        duration: 0.7,
        delay: trailInactiveEls.length > 0 ? 0.3 : 0
      },
      '>'
    )
    tl.to(
      elc,
      {
        x: target.x,
        y: 0,
        scale: target.scale,
        force3D: true,
        ease: 'power3.inOut',
        duration: 0.5,
        delay: 0.1
      },
      '>'
    )
    await tl.then(() => {
      if (activeTimeline === tl) activeTimeline = undefined
      props.setIsAnimating(false)
      scheduleAdjacentPreload(elcIndex, adjacentIndexes)
    })
  }

  const minimizeImage = async (): Promise<void> => {
    if (!mounted || !gsapLoaded) throw new Error('not mounted or gsap not loaded')

    props.setIsAnimating(true)
    props.setNavVector('none') // cleanup
    clearAdjacentPreload()

    const _cordHist = props.cordHist()
    const _state = state()

    const elcIndex = getCurrentElIndex(_cordHist)
    const elsTrailInactiveIndexes = getTrailInactiveElsIndex(_cordHist, _state)

    activeTimeline?.kill()
    const tl = _gsap.timeline()
    activeTimeline = tl
    const elc = getImagesFromIndexes(imgs, [elcIndex])[0]
    const elsTrailInactive = getImagesFromIndexes(imgs, elsTrailInactiveIndexes)
    const latestHistoryItem = _cordHist.at(-1)
    if (latestHistoryItem === undefined)
      throw new Error('missing current image position')

    _gsap.killTweensOf(elsTrailInactive)
    _gsap.set(elsTrailInactive, { opacity: 0, zIndex: 0 })
    tl.to(elc, {
      scale: 0.6,
      duration: 0.6,
      ease: 'power3.inOut'
    })
    tl.to(elc, {
      x: latestHistoryItem.x - (stage?.clientWidth ?? window.innerWidth) / 2,
      y: latestHistoryItem.y - (stage?.clientHeight ?? window.innerHeight) / 2,
      delay: 0.3,
      duration: 0.7,
      ease: 'power3.inOut'
    })
    // eslint-disable-next-line solid/reactivity
    await tl.then(() => {
      if (activeTimeline === tl) activeTimeline = undefined
      lores(getImagesFromIndexes(imgs, [...elsTrailInactiveIndexes, elcIndex]))
      renderedIndexes = new Set([elcIndex])
      expandedImageIndex = undefined
      props.setCordHist([latestHistoryItem])
      props.setIsAnimating(false)
      setPosition()
    })
  }

  function setLoaderForHiresImage(
    img: DesktopImage,
    previousImage?: DesktopImage,
    onDominant?: () => void,
    onRevealed?: () => void
  ): void {
    if (!mounted || !gsapLoaded) return
    const revealIfCurrent = (): void => {
      const history = props.cordHist()
      const current = history.length > 0 ? imgs[getCurrentElIndex(history)] : undefined
      if (!props.isOpen() || current !== img) {
        _gsap.killTweensOf(img, 'opacity')
        _gsap.set(img, { opacity: 0 })
        props.setIsLoading(false)
        return
      }
      _gsap.killTweensOf(img, 'opacity')
      if (previousImage !== undefined) {
        _gsap.killTweensOf(previousImage, 'opacity')
        _gsap.to(previousImage, { opacity: 0, ease: 'power2.out', duration: 0.4 })
      }
      let dominant = false
      const panelContent =
        previousImage !== undefined && onDominant !== undefined
          ? stage?.querySelector<HTMLElement>('.image-info-panel')
          : undefined
      if (panelContent !== undefined && panelContent !== null) {
        panelFadeTimeline?.kill()
        _gsap.killTweensOf(panelContent, 'opacity')
        const timeline = _gsap.timeline()
        panelFadeTimeline = timeline
        timeline
          .to(panelContent, { opacity: 0, ease: 'power2.in', duration: 0.09 })
          .call(() => {
            dominant = true
            onDominant?.()
          })
          .to(panelContent, { opacity: 1, ease: 'power2.out', duration: 0.31 })
        timeline
          .then(() => {
            if (panelFadeTimeline === timeline) panelFadeTimeline = undefined
          })
          .catch((e) => {
            console.log(e)
          })
      }
      const revealTween = _gsap.to(img, {
        opacity: 1,
        ease: 'power3.out',
        duration: 0.5,
        onUpdate: () => {
          if (panelContent !== undefined && panelContent !== null) return
          const imageIsDominant =
            previousImage === undefined
              ? revealTween.progress() >= 0.5
              : Number(getComputedStyle(img).opacity) >=
                Number(getComputedStyle(previousImage).opacity)
          if (dominant || !imageIsDominant) return
          dominant = true
          onDominant?.()
        }
      })
      revealTween
        .then(() => {
          const history = props.cordHist()
          if (history.length > 0 && imgs[getCurrentElIndex(history)] === img) {
            if (!dominant) onDominant?.()
            onRevealed?.()
          }
          props.setIsLoading(false)
        })
        .catch((e) => {
          console.log(e)
        })
    }

    if (!img.complete) {
      props.setIsLoading(true)
      // abort controller for cleanup
      const controller = new AbortController()
      const abortSignal = controller.signal
      // event listeners
      img.addEventListener(
        'load',
        () => {
          revealIfCurrent()
          controller.abort()
        },
        { once: true, passive: true, signal: abortSignal }
      )
      img.addEventListener(
        'error',
        () => {
          revealIfCurrent()
          controller.abort()
        },
        { once: true, passive: true, signal: abortSignal }
      )
    } else {
      revealIfCurrent()
    }
  }

  function updateImageInfoOverlap(): void {
    if (stage === undefined || imageArea === undefined || !props.currentImageInfo()) {
      setImageInfoOverlaps(false)
      stage?.style.removeProperty('--image-info-overlap-width')
      return
    }

    const releaseRow = stage.querySelector<HTMLElement>('.artist-section')
    const panel = stage.querySelector<HTMLElement>('.panel-container')
    if (releaseRow === null || panel === null) return

    // Overlap changes the bounds used to decide whether overlap is needed.
    // Measure the natural side-by-side layout synchronously, then restore the
    // current class before the browser can paint. This avoids an off/on frame.
    const wasOverlapping = stage.classList.contains('image-info-overlap')
    if (wasOverlapping) stage.classList.remove('image-info-overlap')
    const panelBounds = panel.getBoundingClientRect()
    const stageBounds = stage.getBoundingClientRect()
    const panelMinWidth = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--panel-min-width')
    )
    const panelOverflows = panelBounds.right > stageBounds.right + 0.5
    const panelIsTooNarrow = panelBounds.width < panelMinWidth
    const shouldOverlap =
      imageArea.getBoundingClientRect().top >=
        releaseRow.getBoundingClientRect().top - 2 ||
      panelOverflows ||
      panelIsTooNarrow
    if (wasOverlapping && shouldOverlap) stage.classList.add('image-info-overlap')
    if (shouldOverlap === imageInfoOverlaps()) return

    if (shouldOverlap && !panelOverflows && !panelIsTooNarrow) {
      stage.style.setProperty('--image-info-overlap-width', `${panelBounds.width}px`)
    } else stage.style.removeProperty('--image-info-overlap-width')
    setImageInfoOverlaps(shouldOverlap)
  }

  onMount(() => {
    // preload logic
    imgs.forEach((img, i) => {
      // preload first 5 images on page load
      if (i < 5) {
        img.src = img.dataset.loUrl
      }
      // lores preloader for rest of the images
      mutationObservers.push(
        onMutation(img, (mutation) => {
          if (props.isOpen() || props.isAnimating()) return false
          if (mutation.attributeName !== 'style') return false
          const opacity = parseFloat(img.style.opacity)
          if (opacity !== 1) return false
          if (i + 5 < imgs.length) imgs[i + 5].src = imgs[i + 5].dataset.loUrl
          return true
        })
      )
    })
    window.addEventListener('pointermove', () => void ensureGsapReady(), {
      passive: true,
      once: true
    })
    window.addEventListener('pointerdown', () => void ensureGsapReady(), {
      passive: true,
      once: true
    })
    window.addEventListener('click', () => void ensureGsapReady(), {
      passive: true,
      once: true
    })
    // event listeners
    abortController = new AbortController()
    const abortSignal = abortController.signal
    window.addEventListener('mousemove', onMouse, {
      passive: true,
      signal: abortSignal
    })
    lifecycleController = new AbortController()
    window.addEventListener(
      'resize',
      () => {
        activeTimeline?.progress(1)
        if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame)
        resizeFrame = requestAnimationFrame(() => {
          resizeFrame = undefined
          setPosition()
        })
      },
      { passive: true, signal: lifecycleController.signal }
    )
    // mounted
    mounted = true

    onCleanup(() => {
      mounted = false
      abortController?.abort()
      lifecycleController?.abort()
      activeTimeline?.kill()
      panelFadeTimeline?.kill()
      clearAdjacentPreload()
      mutationObservers.forEach((observer) => observer.disconnect())
      if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame)
    })
  })

  createEffect(
    on(
      () => props.cordHist(),
      () => {
        setPosition()
      },
      { defer: true }
    )
  )

  createEffect(
    on(
      () => props.isOpen(),
      async () => {
        if (props.isAnimating()) return
        if (props.isOpen()) {
          if (props.cordHist().length === 0) {
            props.setIsOpen(false)
            return
          }
          // expand image
          await expandImage()
            .catch(() => {
              props.setIsOpen(false)
              props.setIsAnimating(false)
              props.setIsLoading(false)
            })
            .then(() => {
              // abort controller for cleanup
              abortController?.abort()
            })
        } else {
          // minimize image
          await minimizeImage()
            .catch(() => {
              void 0
            })
            // eslint-disable-next-line solid/reactivity
            .then(() => {
              // event listeners and its abort controller
              abortController = new AbortController()
              const abortSignal = abortController.signal
              window.addEventListener('mousemove', onMouse, {
                passive: true,
                signal: abortSignal
              })
              // cleanup isLoading
              props.setIsLoading(false)
            })
        }
      },
      { defer: true }
    )
  )

  return (
    <>
      <div
        ref={stage}
        class="stage"
        classList={{
          trail: props.mode === 'trail',
          closing: props.mode === 'closing',
          'image-info-overlap': imageInfoOverlaps(),
          navigating:
            props.mode === 'navigating' || props.mode === 'navigating-with-info',
          'with-info':
            props.mode === 'opening-with-info' ||
            props.mode === 'expanded-with-info' ||
            props.mode === 'navigating-with-info'
        }}
        data-mode={props.mode}
        onClick={onClick}
        onKeyDown={onClick}
      >
        {/* Wrapper only appears in info mode */}
        <Show
          when={
            props.mode === 'opening-with-info' ||
            props.mode === 'expanded-with-info' ||
            props.mode === 'navigating-with-info'
          }
        >
          <div
            class="image-info-container"
            classList={{
              interactive: props.mode === 'expanded-with-info',
              preparing: props.mode === 'opening-with-info'
            }}
            inert={props.mode !== 'expanded-with-info'}
            aria-hidden={props.mode !== 'expanded-with-info' ? 'true' : undefined}
          >
            <div ref={imageArea} class="image-area" />
            <ImageInfoPanel info={visibleImageInfo()} />
          </div>
        </Show>

        {/* Images always render here (refs stay stable) */}
        <For each={props.ijs}>
          {(ij, i) => (
            <img
              ref={imgs[i()]}
              height={ij.loImgH}
              width={ij.loImgW}
              data-hi-url={ij.hiUrl}
              data-hi-img-h={ij.hiImgH}
              data-hi-img-w={ij.hiImgW}
              data-lo-url={ij.loUrl}
              data-lo-img-h={ij.loImgH}
              data-lo-img-w={ij.loImgW}
              alt={ij.alt}
            />
          )}
        </For>
      </div>
    </>
  )
}
