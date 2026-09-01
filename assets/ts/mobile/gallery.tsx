import { type gsap } from 'gsap'
import {
  createEffect,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Show,
  untrack,
  type Accessor,
  type JSX,
  type Setter
} from 'solid-js'
import { createStore } from 'solid-js/store'
import { type Swiper } from 'swiper'
import invariant from 'tiny-invariant'

import { type ImageJSON } from '../resources'
import { useState } from '../state'
import { loadGsap, type Vector } from '../utils'

import GalleryImage from './galleryImage'
import GalleryNav, { capitalizeFirstLetter } from './galleryNav'
import MobileImageInfoPanel from './imageInfoPanel'

function removeDuplicates<T>(arr: T[]): T[] {
  if (arr.length < 2) return arr // optimization
  return [...new Set(arr)]
}

async function loadSwiper(): Promise<typeof Swiper> {
  const s = await import('swiper')
  return s.Swiper
}

export default function Gallery(props: {
  children?: JSX.Element
  ijs: ImageJSON[]
  closeText: string
  loadingText: string
  isAnimating: Accessor<boolean>
  setIsAnimating: Setter<boolean>
  isOpen: Accessor<boolean>
  setIsOpen: Setter<boolean>
  setScrollable: Setter<boolean>
}): JSX.Element {
  // variables
  let _gsap: typeof gsap
  let _swiper: Swiper | undefined
  let initPromise: Promise<void> | undefined
  let activeTransition: gsap.core.Timeline | undefined
  let resizeFrame: number | undefined

  let curtain: HTMLDivElement | undefined
  let gallery: HTMLDivElement | undefined
  let galleryInner: HTMLDivElement | undefined

  // eslint-disable-next-line solid/reactivity
  const _loadingText = capitalizeFirstLetter(props.loadingText)

  // states
  let lastIndex = -1
  let mounted = false
  let navigateVector: Vector = 'none'

  const [state, { setIndex }] = useState()
  const [libLoaded, setLibLoaded] = createSignal(false)
  const [swiperReady, setSwiperReady] = createSignal(false)
  // eslint-disable-next-line solid/reactivity
  const [loads, setLoads] = createStore(Array<boolean>(props.ijs.length).fill(false))

  // helper functions
  const slideUp: () => void = () => {
    if (!libLoaded() || !mounted) return
    props.setIsAnimating(true)
    props.setScrollable(false)

    invariant(curtain, 'curtain is not defined')
    invariant(gallery, 'gallery is not defined')

    activeTransition?.kill()
    _gsap.killTweensOf([curtain, gallery])
    activeTransition = _gsap
      .timeline({
        onComplete: () => {
          activeTransition = undefined
          props.setIsAnimating(false)
        }
      })
      .to(curtain, { opacity: 1, duration: 1 }, 0)
      .to(gallery, { yPercent: 0, ease: 'power3.inOut', duration: 1 }, 0.4)
  }

  const slideDown: () => void = () => {
    // isAnimating is prechecked in isOpen effect
    props.setIsAnimating(true)

    invariant(gallery, 'curtain is not defined')
    invariant(curtain, 'gallery is not defined')

    activeTransition?.kill()
    _gsap.killTweensOf([curtain, gallery])
    activeTransition = _gsap
      .timeline({
        onComplete: () => {
          activeTransition = undefined
          props.setScrollable(true)
          props.setIsAnimating(false)
          lastIndex = -1
        }
      })
      .to(gallery, { yPercent: 100, ease: 'power3.inOut', duration: 1 }, 0)
      .to(curtain, { opacity: 0, duration: 1.2 }, 0.4)
  }

  const galleryLoadImages: () => void = () => {
    let activeImagesIndex: number[] = []
    const _state = state()
    const currentIndex = _state.index
    const nextIndex = Math.min(currentIndex + 1, _state.length - 1)
    const prevIndex = Math.max(currentIndex - 1, 0)
    switch (navigateVector) {
      case 'next':
        activeImagesIndex = [nextIndex]
        break
      case 'prev':
        activeImagesIndex = [prevIndex]
        break
      case 'none':
        activeImagesIndex = [currentIndex, nextIndex, prevIndex]
        break
    }
    setLoads(removeDuplicates(activeImagesIndex), true)
  }

  const changeSlide: (slide: number) => void = (slide) => {
    if (!swiperReady() || _swiper === undefined) return
    galleryLoadImages()
    _swiper.slideTo(slide, 0)
  }

  const ensureGalleryReady = async (): Promise<void> => {
    if (initPromise !== undefined) return await initPromise

    initPromise = (async () => {
      try {
        const [g, S] = await Promise.all([loadGsap(), loadSwiper()])
        _gsap = g

        invariant(galleryInner, 'galleryInner is not defined')
        invariant(gallery, 'gallery is not defined')
        _gsap.set(gallery, { y: 0, yPercent: 100 })
        _swiper = new S(galleryInner, { spaceBetween: 20 })
        _swiper.on('slideChange', ({ realIndex }) => {
          setIndex(realIndex)
        })

        setLibLoaded(true)
        setSwiperReady(true)

        const initialIndex = untrack(() => state().index)
        if (initialIndex >= 0) {
          changeSlide(initialIndex)
          lastIndex = initialIndex
        }
      } catch (e) {
        initPromise = undefined
        setSwiperReady(false)
        console.log(e)
      }
    })()

    await initPromise
  }

  // effects
  onMount(() => {
    const controller = new AbortController()
    const signal = controller.signal
    window.addEventListener('pointerdown', () => void ensureGalleryReady(), {
      once: true,
      passive: true,
      signal
    })
    window.addEventListener(
      'resize',
      () => {
        if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame)
        resizeFrame = requestAnimationFrame(() => {
          resizeFrame = undefined
          _swiper?.update()
          if (
            _gsap !== undefined &&
            gallery !== undefined &&
            activeTransition === undefined
          ) {
            _gsap.set(gallery, { yPercent: props.isOpen() ? 0 : 100 })
          }
        })
      },
      { passive: true, signal }
    )
    mounted = true

    onCleanup(() => {
      mounted = false
      controller.abort()
      activeTransition?.kill()
      _swiper?.destroy()
      if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame)
    })
  })

  createEffect(
    on(
      () => [swiperReady(), state().index] as const,
      ([ready, i]) => {
        if (!ready || i < 0) return
        if (i === lastIndex)
          return // change slide only when index is changed
        else if (lastIndex === -1)
          navigateVector = 'none' // lastIndex before set
        else if (i < lastIndex)
          navigateVector = 'prev' // set navigate vector for galleryLoadImages
        else if (i > lastIndex)
          navigateVector = 'next' // set navigate vector for galleryLoadImages
        else navigateVector = 'none' // default
        changeSlide(i) // change slide to new index
        lastIndex = i // update last index
      }
    )
  )

  createEffect(
    on(
      () => props.isOpen(),
      async (isOpen) => {
        if (isOpen && !swiperReady()) await ensureGalleryReady()
        if (!libLoaded() || !swiperReady()) return
        if (props.isAnimating()) return
        if (isOpen) slideUp()
        else slideDown()
      },
      { defer: true }
    )
  )

  return (
    <>
      <div ref={gallery} class="gallery">
        <div ref={galleryInner} class="galleryInner">
          <div class="swiper-wrapper">
            <For each={props.ijs}>
              {(ij, i) => (
                <div class={`swiper-slide ${ij.imageInfo ? 'has-info' : ''}`}>
                  <div class="slide-content">
                    <GalleryImage
                      load={loads[i()]}
                      ij={ij}
                      loadingText={_loadingText}
                    />
                    <Show when={Math.abs(state().index - i()) <= 1 && ij.imageInfo}>
                      <MobileImageInfoPanel info={ij.imageInfo} />
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
        <GalleryNav
          closeText={props.closeText}
          isAnimating={props.isAnimating}
          setIsOpen={props.setIsOpen}
        />
      </div>
      <div ref={curtain} class="curtain" />
    </>
  )
}
