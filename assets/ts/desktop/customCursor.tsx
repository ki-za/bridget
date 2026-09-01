import { createSignal, onCleanup, onMount, type Accessor, type JSX } from 'solid-js'

export default function CustomCursor(props: {
  children?: JSX.Element
  active: Accessor<boolean>
  cursorText: Accessor<string>
  isOpen: Accessor<boolean>
}): JSX.Element {
  // variables
  let controller: AbortController | undefined
  let cursor: HTMLDivElement | undefined
  let frame: number | undefined
  let nextX = 0
  let nextY = 0

  // states
  const [suppressed, setSuppressed] = createSignal(false) // whether to hide the custom-cursor

  // helper functions

  const onMouse: (e: MouseEvent) => void = (e) => {
    nextX = e.clientX
    nextY = e.clientY
    if (frame !== undefined) return

    frame = requestAnimationFrame(() => {
      frame = undefined
      if (cursor !== undefined) {
        cursor.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`
      }

      const elementUnderCursor = document.elementFromPoint(nextX, nextY)

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

        setSuppressed(hasDefaultCursor || isInteractiveElement)
      }
    })
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
    if (frame !== undefined) cancelAnimationFrame(frame)
  })

  return (
    <>
      <div
        ref={cursor}
        class="cursor"
        classList={{ active: props.active(), suppressed: suppressed() }}
      >
        <div class="cursorInner">{props.cursorText()}</div>
      </div>
    </>
  )
}
