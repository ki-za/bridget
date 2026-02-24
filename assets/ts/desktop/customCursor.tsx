import { createSignal, onCleanup, onMount, type Accessor, type JSX } from 'solid-js'

export default function CustomCursor(props: {
  children?: JSX.Element
  active: Accessor<boolean>
  cursorText: Accessor<string>
  isOpen: Accessor<boolean>
}): JSX.Element {
  // types
  interface XY {
    x: number
    y: number
  }

  // variables
  let controller: AbortController | undefined

  // states
  const [xy, setXy] = createSignal<XY>({ x: 0, y: 0 })
  const [suppressed, setSuppressed] = createSignal(false) // whether to hide the custom-cursor

  // helper functions

  const onMouse: (e: MouseEvent) => void = (e) => {
    const { clientX, clientY, target } = e
    setXy({ x: clientX, y: clientY })

    const elementUnderCursor = document.elementFromPoint(clientX, clientY)

    if (elementUnderCursor instanceof HTMLElement) {
      const cursorStyle = getComputedStyle(elementUnderCursor).cursor
      const tag = elementUnderCursor.tagName

      const isInteractiveElement =
        tag === 'A' ||
        tag === 'BUTTON' ||
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT'

      const hasDefaultCursor = cursorStyle === 'default' || cursorStyle === 'text'

      const shouldSuppress = hasDefaultCursor || isInteractiveElement

      setSuppressed(shouldSuppress)
    }

    // if (target instanceof HTMLElement) {
    //   const tag = target.tagName // category of mouse hover location
    //   const pointerStyle = getComputedStyle(target).cursor
    //   console.log(pointerStyle)
    //
    //   const shouldHide =
    //     tag === 'A' ||
    //     tag === 'BUTTON' ||
    //     tag === 'INPUT' ||
    //     tag === 'TEXTAREA' ||
    //     tag === 'SELECT' ||
    //     pointerStyle === 'text' ||
    //     pointerStyle === 'pointer' ||
    //     pointerStyle === 'default'
    //
    //   setSuppressed(shouldHide)
    // }
  }
  // effects
  onMount(() => {
    controller = new AbortController()
    const abortSignal = controller.signal
    window.addEventListener('mousemove', onMouse, {
      passive: true,
      signal: abortSignal
    })
  })

  onCleanup(() => {
    controller?.abort()
  })

  return (
    <>
      <div
        class="cursor"
        classList={{ active: props.active(), suppressed: suppressed() }}
        style={{ transform: `translate3d(${xy().x}px, ${xy().y}px, 0)` }}
      >
        <div class="cursorInner">{props.cursorText()}</div>
      </div>
    </>
  )
}
