import { expect, test, type Page } from '@playwright/test'

interface ImageState {
  index: number
  opacity: number
  scale: number
  x: number
  y: number
  z: number
}

interface AnimationFrame {
  images: ImageState[]
  linkIsHitTarget?: boolean
  linkVisuallyVisible?: boolean
  linkZIndex?: string
  mode: string
  panelContentOpacity?: number
  panelInert?: boolean
  panelOpacity?: number
  panelOverlaps?: boolean
  panelWidth?: number
  panelX?: number
  panelZIndex?: string
  title?: string
}

const stage = '.stage'
const images = '.stage img'
const overlays = '.navOverlay .overlay'

async function imageStates(page: Page): Promise<ImageState[]> {
  return await page.locator(images).evaluateAll((elements) =>
    elements.map((element, index) => {
      const image = element as HTMLImageElement
      const style = getComputedStyle(image)
      const matrix = new DOMMatrixReadOnly(style.transform)
      return {
        index,
        opacity: Number(style.opacity),
        scale: Math.hypot(matrix.a, matrix.b),
        x: matrix.e,
        y: matrix.f,
        z: Number(style.zIndex || 0)
      }
    })
  )
}

function visible(states: ImageState[], minimumOpacity = 0.01): ImageState[] {
  return states.filter(({ opacity }) => opacity > minimumOpacity)
}

async function openCollection(
  page: Page,
  path: string,
  thresholdIndex = 2
): Promise<void> {
  await page.addInitScript((index) => {
    sessionStorage.setItem('thresholdsIndex', String(index))
  }, thresholdIndex)
  await page.goto(path)
  await expect(page.locator(stage)).toBeVisible()
  await expect(page.locator(images).first()).toBeAttached()
  expect(visible(await imageStates(page))).toHaveLength(0)

  // The first pointer movement starts the lazily loaded animation runtime.
  await page.mouse.move(20, 120)
  await page.waitForTimeout(250)
}

async function buildTrail(page: Page, crossings: number): Promise<ImageState[]> {
  const viewport = page.viewportSize()!
  for (let index = 0; index < crossings; index += 1) {
    await page.mouse.move(
      index % 2 === 0 ? viewport.width - 20 : 20,
      160 + (index % 5) * 110
    )
    await page.waitForTimeout(25)
  }
  return visible(await imageStates(page), 0.95)
}

async function waitForSlideshow(page: Page): Promise<void> {
  await expect(page.locator('.navOverlay')).toHaveClass(/active/, { timeout: 5_000 })
  await expect.poll(async () => visible(await imageStates(page), 0.95).length).toBe(1)
}

async function openSlideshow(page: Page): Promise<void> {
  await page.mouse.down()
  await page.mouse.up()
  await waitForSlideshow(page)
}

async function navigate(page: Page, direction: 'previous' | 'next'): Promise<void> {
  const oldIndex = visible(await imageStates(page), 0.95)[0]?.index
  const viewport = page.viewportSize()!
  await page.mouse.click(
    direction === 'previous' ? 2 : viewport.width - 2,
    viewport.height / 2
  )
  await expect
    .poll(async () => visible(await imageStates(page), 0.95)[0]?.index)
    .not.toBe(oldIndex)
  await expect.poll(async () => visible(await imageStates(page), 0.01).length).toBe(1)
  await waitForSlideshow(page)
}

async function closeSlideshow(page: Page): Promise<void> {
  const viewport = page.viewportSize()!
  await page.mouse.click(viewport.width / 2, Math.min(80, viewport.height / 4))
  await expect(page.locator('.navOverlay')).not.toHaveClass(/active/)
  await expect(page.locator(stage)).toHaveClass(/closing/)
  await expect(page.locator(stage)).toHaveClass(/trail/)
  await expect.poll(async () => visible(await imageStates(page), 0.95).length).toBe(1)
}

async function recordAnimation(
  page: Page,
  overlayIndex?: number
): Promise<{ initial: ImageState[]; frames: AnimationFrame[] }> {
  return await page.evaluate(
    async ({ stageSelector, imageSelector, overlaySelector, requestedOverlay }) => {
      const readImages = (): ImageState[] =>
        Array.from(document.querySelectorAll(imageSelector)).map((element, index) => {
          const style = getComputedStyle(element)
          const matrix = new DOMMatrixReadOnly(style.transform)
          return {
            index,
            opacity: Number(style.opacity),
            scale: Math.hypot(matrix.a, matrix.b),
            x: matrix.e,
            y: matrix.f,
            z: Number(style.zIndex || 0)
          }
        })

      const initial = readImages()
      const initialTitle =
        document.querySelector('.project-name')?.textContent?.trim() ?? undefined
      const target =
        requestedOverlay === undefined
          ? document.querySelector<HTMLElement>(stageSelector)
          : document.querySelectorAll<HTMLElement>(overlaySelector)[requestedOverlay]
      target?.click()

      const frames: AnimationFrame[] = []
      await new Promise<void>((resolve) => {
        let count = 0
        const sample = (): void => {
          const overlay = document.querySelector('.navOverlay')
          const stageElement = document.querySelector<HTMLElement>(stageSelector)
          const infoContainer = document.querySelector<HTMLElement>(
            '.image-info-container'
          )
          const panel = document.querySelector<HTMLElement>('.panel-container')
          const panelBounds = panel?.getBoundingClientRect()
          const panelContent = document.querySelector<HTMLElement>('.image-info-panel')
          const link = document.querySelector<HTMLElement>('.image-info-panel a')
          const linkBox = link?.getBoundingClientRect()
          const linkHit =
            linkBox === undefined
              ? undefined
              : document.elementFromPoint(
                  linkBox.left + linkBox.width / 2,
                  linkBox.top + linkBox.height / 2
                )
          const frame = {
            images: readImages(),
            linkIsHitTarget:
              link === null || linkHit === undefined
                ? undefined
                : link.contains(linkHit),
            linkVisuallyVisible:
              link === null
                ? undefined
                : link.checkVisibility({
                    checkOpacity: true,
                    checkVisibilityCSS: true
                  }),
            linkZIndex: link === null ? undefined : getComputedStyle(link).zIndex,
            mode: stageElement?.dataset.mode ?? stageElement?.className ?? '',
            panelContentOpacity:
              panelContent === null
                ? undefined
                : Number(getComputedStyle(panelContent).opacity),
            panelInert: infoContainer?.inert,
            panelOpacity:
              panel === null ? undefined : Number(getComputedStyle(panel).opacity),
            panelOverlaps: stageElement?.classList.contains('image-info-overlap'),
            panelWidth: panelBounds?.width,
            panelX: panelBounds?.x,
            panelZIndex: panel === null ? undefined : getComputedStyle(panel).zIndex,
            title:
              document.querySelector('.project-name')?.textContent?.trim() ?? undefined
          }
          frames.push(frame)
          count += 1

          const openingComplete =
            requestedOverlay === undefined &&
            overlay?.classList.contains('active') === true
          const navigationComplete =
            requestedOverlay !== undefined &&
            requestedOverlay !== 1 &&
            count > 2 &&
            frame.images.filter(({ opacity }) => opacity > 0.01).length === 1 &&
            frame.images.some(({ opacity }) => opacity > 0.99) &&
            (initialTitle === undefined || frame.title !== initialTitle)
          const closingComplete = requestedOverlay === 1 && frame.mode.includes('trail')
          if (openingComplete || navigationComplete || closingComplete || count >= 240)
            resolve()
          else requestAnimationFrame(sample)
        }
        requestAnimationFrame(sample)
      })
      return { initial, frames }
    },
    {
      stageSelector: stage,
      imageSelector: images,
      overlaySelector: overlays,
      requestedOverlay: overlayIndex
    }
  )
}

test.describe('desktop gallery interaction matrix', () => {
  const thresholds = [
    { index: 0, expectedTrail: 14 },
    { index: 1, expectedTrail: 10 },
    { index: 2, expectedTrail: 5 },
    { index: 3, expectedTrail: 5 },
    { index: 4, expectedTrail: 5 }
  ]

  for (const { index, expectedTrail } of thresholds) {
    test(`threshold setting ${index} caps the trail at ${expectedTrail} unique images`, async ({
      page
    }) => {
      await openCollection(page, '/', index)
      const trail = await buildTrail(page, 18)
      expect(trail).toHaveLength(expectedTrail)
      expect(new Set(trail.map(({ index: imageIndex }) => imageIndex)).size).toBe(
        expectedTrail
      )
    })
  }

  test('opening fades oldest-to-newest before enlarging the front image', async ({
    page
  }) => {
    await openCollection(page, '/')
    const trail = await buildTrail(page, 5)
    expect(trail).toHaveLength(5)

    const orderedTrail = [...trail].sort((left, right) => left.z - right.z)
    const front = orderedTrail.at(-1)
    expect(front).toBeDefined()

    await page
      .locator(images)
      .nth(front!.index)
      .evaluate((image) => {
        const decodeGate = new Promise<void>((resolve) => {
          ;(
            window as typeof window & { releaseOpeningDecode?: () => void }
          ).releaseOpeningDecode = resolve
        })
        ;(image as HTMLImageElement).decode = async () => await decodeGate
      })
    const animation = recordAnimation(page)
    await expect(page.locator(stage)).toHaveAttribute('data-mode', 'opening-with-info')
    const openingInfo = page.locator('.image-info-container')
    const openingPanel = page.locator('.panel-container')
    const openingDivider = page.locator('.section-divider').first()
    await expect(openingInfo).toBeAttached()
    await expect(openingPanel).toHaveCSS('opacity', '0')
    await expect(openingDivider).toHaveCSS('opacity', '0')
    await expect(openingPanel).toHaveCSS('will-change', 'opacity')
    await expect(openingInfo).toHaveAttribute('inert', '')
    await expect(openingInfo).toHaveAttribute('aria-hidden', 'true')
    const openingInfoElement = await openingInfo.elementHandle()
    const openingPanelElement = await openingPanel.elementHandle()
    const collectionLength = await page.locator(images).count()
    const adjacentIndexes = [
      (front!.index + collectionLength - 1) % collectionLength,
      (front!.index + 1) % collectionLength
    ]
    const usesHighResolutionSource = async (imageIndex: number): Promise<boolean> =>
      await page
        .locator(images)
        .nth(imageIndex)
        .evaluate(
          (image) =>
            (image as HTMLImageElement).src ===
            new URL((image as HTMLImageElement).dataset.hiUrl!, location.href).href
        )
    expect(await usesHighResolutionSource(front!.index)).toBe(true)
    expect(await Promise.all(adjacentIndexes.map(usesHighResolutionSource))).toEqual([
      false,
      false
    ])
    await page.waitForTimeout(100)
    const loadingText = await page.locator('.container').getAttribute('data-loading')
    await expect(page.locator('.cursor')).toHaveClass(/active/)
    await expect(page.locator('.cursorInner')).toHaveText(loadingText!)
    const waitingForDecode = await imageStates(page)
    expect(
      orderedTrail.every(({ index, opacity, scale, x, y }) => {
        const waitingImage = waitingForDecode[index]
        return (
          Math.abs(waitingImage.opacity - opacity) < 0.01 &&
          Math.abs(waitingImage.scale - scale) < 0.001 &&
          Math.abs(waitingImage.x - x) < 1 &&
          Math.abs(waitingImage.y - y) < 1
        )
      })
    ).toBe(true)
    await page.evaluate(() => {
      ;(
        window as typeof window & { releaseOpeningDecode?: () => void }
      ).releaseOpeningDecode?.()
    })
    const { frames } = await animation
    const openingFrames = frames.filter(
      ({ mode, panelOpacity }) =>
        mode === 'opening-with-info' && panelOpacity !== undefined
    )
    expect(openingFrames.length).toBeGreaterThan(0)
    expect(
      openingFrames.every(
        ({
          linkIsHitTarget,
          linkVisuallyVisible,
          linkZIndex,
          panelInert,
          panelOpacity,
          panelZIndex
        }) =>
          panelOpacity === 0 &&
          panelInert === true &&
          linkIsHitTarget === false &&
          linkVisuallyVisible === false &&
          linkZIndex === 'auto' &&
          panelZIndex === '0'
      )
    ).toBe(true)
    const inactive = orderedTrail.slice(0, -1).map(({ index }) => index)
    const fadeStart = inactive.map((imageIndex) =>
      frames.findIndex(
        ({ images: frameImages }) => frameImages[imageIndex].opacity < 0.95
      )
    )
    expect(fadeStart.every((frameIndex) => frameIndex >= 0)).toBe(true)
    expect(fadeStart).toEqual([...fadeStart].sort((left, right) => left - right))

    const scaleStart = frames.findIndex(
      ({ images: frameImages }) =>
        frameImages[front!.index].scale > front!.scale + 0.001
    )
    expect(scaleStart).toBeGreaterThan(0)
    const fadeEnd = frames.findIndex(({ images: frameImages }) =>
      inactive.every((imageIndex) => frameImages[imageIndex].opacity < 0.05)
    )
    const movementStart = frames.findIndex(({ images: frameImages }) => {
      const current = frameImages[front!.index]
      return Math.abs(current.x - front!.x) > 1 || Math.abs(current.y - front!.y) > 1
    })
    expect(movementStart).toBeGreaterThan(fadeEnd)
    expect(scaleStart).toBeGreaterThan(movementStart)
    const frameBeforeScale = frames[scaleStart - 1]
    expect(
      inactive.every((imageIndex) => frameBeforeScale.images[imageIndex].opacity < 0.05)
    ).toBe(true)
    expect(
      frames.slice(movementStart, scaleStart).some(({ images: frameImages }) => {
        const image = frameImages[front!.index]
        return Math.abs(image.x) < 2 && Math.abs(image.y) < 2
      })
    ).toBe(true)
    expect(
      frames.every(
        ({ images: frameImages }) => frameImages[front!.index].opacity > 0.98
      )
    ).toBe(true)
    expect(visible(frames.at(-1)!.images, 0.95).map(({ index }) => index)).toEqual([
      front!.index
    ])
    expect(
      await page
        .locator(images)
        .nth(front!.index)
        .evaluate((image) => (image as HTMLElement).style.transform)
    ).toContain('translate3d')
    await expect(openingPanel).toHaveCSS('opacity', '1')
    await expect(openingDivider).toHaveCSS('opacity', '1')
    await expect(openingDivider).toHaveCSS('transition-duration', '0.3s')
    await expect(openingDivider).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.08)')
    await expect(openingInfo).not.toHaveAttribute('inert', '')
    await expect(openingInfo).not.toHaveAttribute('aria-hidden', 'true')
    const expandedLink = page.locator('.image-info-panel a').first()
    await expect(expandedLink).toBeEnabled()
    await expect(expandedLink).toHaveCSS('z-index', 'auto')
    await expect(page.locator('.image-info-panel')).toHaveCSS('pointer-events', 'none')
    await expect(page.locator('.project-header')).toHaveCSS('pointer-events', 'auto')
    expect(
      await page.locator('.panel-container').evaluate((panel) => {
        const overlay = document.querySelector('.navOverlay')
        const link = panel.querySelector<HTMLAnchorElement>('.image-info-panel a')!
        const box = link.getBoundingClientRect()
        return {
          aboveNavigation:
            Number(getComputedStyle(panel).zIndex) >
            Number(getComputedStyle(overlay!).zIndex),
          linkIsHitTarget: link.contains(
            document.elementFromPoint(
              box.left + box.width / 2,
              box.top + box.height / 2
            )
          )
        }
      })
    ).toEqual({ aboveNavigation: true, linkIsHitTarget: true })
    await expandedLink.evaluate((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault()
        link.dataset.testClicked = 'true'
      })
    })
    await expandedLink.click()
    await expect(expandedLink).toHaveAttribute('data-test-clicked', 'true')
    await expect
      .poll(
        async () => await Promise.all(adjacentIndexes.map(usesHighResolutionSource))
      )
      .toEqual([true, true])
    expect(
      await openingInfoElement!.evaluate(
        (element) => element === document.querySelector('.image-info-container')
      )
    ).toBe(true)
    expect(
      await openingPanelElement!.evaluate(
        (element) => element === document.querySelector('.panel-container')
      )
    ).toBe(true)
  })

  test('slideshow navigation is a non-blank, geometry-stable crossfade', async ({
    page
  }) => {
    await openCollection(page, '/')
    await buildTrail(page, 5)
    await openSlideshow(page)

    const oldTitle = (await page.locator('.project-name').textContent())?.trim()
    const oldIndex = visible(await imageStates(page), 0.95)[0].index
    const { frames } = await recordAnimation(page, 2)
    const finalFrame = frames.at(-1)!
    const finalVisible = visible(finalFrame.images, 0.95)
    expect(finalVisible).toHaveLength(1)
    expect(finalVisible[0].index).not.toBe(oldIndex)
    expect(finalFrame.title).not.toBe(oldTitle)

    for (const frame of frames) {
      const shown = visible(frame.images)
      expect(shown.length).toBeGreaterThan(0)
      expect(shown.length).toBeLessThanOrEqual(2)
      expect(shown.reduce((sum, image) => sum + image.opacity, 0)).toBeGreaterThan(0.85)
      if (shown.length === 2) {
        expect(Math.abs(shown[0].scale - shown[1].scale)).toBeLessThan(0.01)
        expect(Math.abs(shown[0].x - shown[1].x)).toBeLessThan(1)
        expect(Math.abs(shown[0].y - shown[1].y)).toBeLessThan(1)
      }
      const oldOpacity = frame.images[oldIndex].opacity
      const newOpacity = frame.images[finalVisible[0].index].opacity
      if (frame.title === oldTitle)
        expect(oldOpacity + 0.05).toBeGreaterThan(newOpacity)
      else expect(newOpacity + 0.05).toBeGreaterThan(oldOpacity)
    }

    await waitForSlideshow(page)
    const overlayBox = await page.locator('.navOverlay').boundingBox()
    expect(overlayBox).not.toBeNull()
    expect(overlayBox!.x).toBe(0)
    expect(overlayBox!.width).toBe(page.viewportSize()!.width)
    await expect(page.locator('.image-info-panel a').first()).toBeEnabled()
  })

  test('narrow overlay navigation keeps the panel fixed while its content fades', async ({
    page
  }) => {
    await page.setViewportSize({ width: 700, height: 600 })
    await openCollection(page, '/')
    await buildTrail(page, 4)
    await openSlideshow(page)

    await expect(page.locator(stage)).toHaveClass(/image-info-overlap/)
    const initialPanel = await page.locator('.panel-container').boundingBox()
    expect(initialPanel).not.toBeNull()

    const { frames } = await recordAnimation(page, 2)
    for (const frame of frames) {
      expect(frame.panelOverlaps).toBe(true)
      expect(Math.abs(frame.panelX! - initialPanel!.x)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(frame.panelWidth! - initialPanel!.width)).toBeLessThanOrEqual(0.5)
    }

    expect(
      Math.min(...frames.map(({ panelContentOpacity }) => panelContentOpacity ?? 1))
    ).toBeLessThan(0.1)
    expect(frames.every(({ panelOpacity }) => panelOpacity === 1)).toBe(true)
    expect(frames.at(-1)!.panelOpacity).toBeGreaterThan(0.99)
  })

  test('viewport navigation surrounds interactive, selectable info blocks', async ({
    page
  }) => {
    await openCollection(page, '/')
    await buildTrail(page, 5)
    await openSlideshow(page)

    const viewport = page.viewportSize()!
    const navWidths = await page
      .locator(overlays)
      .evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().width)
      )
    expect(navWidths).toHaveLength(3)
    navWidths.forEach((width) => {
      expect(width).toBeCloseTo(viewport.width / 3, 0)
    })

    const panel = page.locator('.image-info-panel')
    const panelBox = await panel.boundingBox()
    expect(panelBox).not.toBeNull()

    const hitSpine = panel.locator('.image-info-hit-spine')
    const hitSpineBox = await hitSpine.boundingBox()
    expect(hitSpineBox).not.toBeNull()
    expect(hitSpineBox!.height).toBeCloseTo(panelBox!.height, 0)
    const spineActions = await page.evaluate(
      ({ x, top, bottom }) => {
        const actions = new Set<string>()
        for (let y = Math.ceil(top + 2); y < Math.floor(bottom - 2); y += 2) {
          const action = document
            .elementFromPoint(x, y)
            ?.closest<HTMLElement>('[data-nav-action]')?.dataset.navAction
          actions.add(action ?? 'blocked')
        }
        return [...actions]
      },
      {
        x: hitSpineBox!.x + hitSpineBox!.width / 2,
        top: hitSpineBox!.y,
        bottom: hitSpineBox!.y + hitSpineBox!.height
      }
    )
    expect(spineActions).toEqual(['blocked'])
    const verticalGap = await page.evaluate(
      ({ left, right, top, bottom }) => {
        for (let x = Math.ceil(left + 2); x < Math.floor(right - 2); x += 2) {
          const column: Array<{ blocked: boolean; y: number }> = []
          for (let y = Math.ceil(top + 2); y < Math.floor(bottom - 2); y += 2) {
            const navAction = document
              .elementFromPoint(x, y)
              ?.closest<HTMLElement>('[data-nav-action]')?.dataset.navAction
            column.push({ blocked: navAction === undefined, y })
          }

          const firstBlocked = column.findIndex(({ blocked }) => blocked)
          const lastBlocked = column.findLastIndex(({ blocked }) => blocked)
          if (firstBlocked === -1) continue
          const gap = column
            .slice(firstBlocked, lastBlocked + 1)
            .find(({ blocked }) => !blocked)
          if (gap !== undefined) return { x, y: gap.y }
        }
        return null
      },
      {
        left: panelBox!.x,
        right: panelBox!.x + panelBox!.width,
        top: panelBox!.y,
        bottom: panelBox!.y + panelBox!.height
      }
    )
    expect(verticalGap).toBeNull()

    const title = panel.locator('.project-name')
    const titleBox = await title.boundingBox()
    expect(titleBox).not.toBeNull()
    const textHitOwner = await page.evaluate(
      ({ x, y }) => {
        const hit = document.elementFromPoint(x, y)
        return {
          insidePanel: hit?.closest('.image-info-panel') !== null,
          navAction: hit?.closest<HTMLElement>('[data-nav-action]')?.dataset.navAction
        }
      },
      { x: titleBox!.x + titleBox!.width / 2, y: titleBox!.y + titleBox!.height / 2 }
    )
    expect(textHitOwner).toEqual({ insidePanel: true, navAction: undefined })
    const paddedTitleHitOwner = await page.evaluate(
      ({ x, y }) =>
        document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-nav-action]')
          ?.dataset.navAction,
      { x: titleBox!.x - 4, y: titleBox!.y + titleBox!.height / 2 }
    )
    expect(paddedTitleHitOwner).toBeUndefined()

    const emptyPanelPoint = await page.evaluate(
      ({ left, right, top, bottom }) => {
        for (let y = Math.ceil(top); y < Math.floor(bottom); y += 4) {
          for (let x = Math.ceil(left); x < Math.floor(right); x += 4) {
            const action = document
              .elementFromPoint(x, y)
              ?.closest<HTMLElement>('[data-nav-action]')?.dataset.navAction
            if (action !== undefined) return { action, x, y }
          }
        }
        return null
      },
      {
        left: panelBox!.x,
        right: panelBox!.x + panelBox!.width,
        top: panelBox!.y,
        bottom: panelBox!.y + panelBox!.height
      }
    )
    expect(emptyPanelPoint?.action).toBe('next')
    await expect(panel).toHaveCSS('user-select', 'text')

    const cursorText = page.locator('.cursorInner')
    await page.mouse.move(viewport.width - 2, viewport.height / 2)
    await expect(cursorText).not.toHaveText('')
    await page.mouse.move(
      titleBox!.x + titleBox!.width / 2,
      titleBox!.y + titleBox!.height / 2
    )
    await expect(cursorText).toHaveText('')
    for (const y of [
      hitSpineBox!.y + 2,
      hitSpineBox!.y + hitSpineBox!.height / 2,
      hitSpineBox!.y + hitSpineBox!.height - 2
    ]) {
      await page.mouse.move(hitSpineBox!.x + hitSpineBox!.width / 2, y)
      await expect(cursorText).toHaveText('')
    }

    const trackListBox = await panel.locator('.track-list').boundingBox()
    expect(trackListBox).not.toBeNull()
    expect(trackListBox!.width).toBeGreaterThan(panelBox!.width * 0.9)
    const projectLinksBox = await panel.locator('.project-links').boundingBox()
    expect(projectLinksBox).not.toBeNull()
    expect(projectLinksBox!.width).toBeLessThan(panelBox!.width * 0.9)
    const trackWhitespaceOwner = await page.evaluate(
      ({ x, y }) =>
        document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-nav-action]')
          ?.dataset.navAction,
      {
        x: trackListBox!.x + trackListBox!.width - 2,
        y: trackListBox!.y + trackListBox!.height / 2
      }
    )
    expect(trackWhitespaceOwner).toBeUndefined()

    await page.mouse.move(titleBox!.x + 3, titleBox!.y + titleBox!.height / 2)
    await page.mouse.down()
    await page.mouse.move(
      titleBox!.x + titleBox!.width - 3,
      titleBox!.y + titleBox!.height / 2,
      { steps: 8 }
    )
    await page.mouse.up()
    expect(
      await page.evaluate(() => window.getSelection()?.toString().trim())
    ).not.toBe('')

    const initialIndex = visible(await imageStates(page), 0.95)[0].index
    await title.click()
    await page.waitForTimeout(100)
    expect(visible(await imageStates(page), 0.95)[0].index).toBe(initialIndex)
    await expect(page.locator('.navOverlay')).toHaveClass(/active/)

    const tracks = panel.locator('.track-items')
    await tracks.evaluate((element) => {
      element.style.maxHeight = '2rem'
    })
    expect(
      await tracks.evaluate((element) => element.scrollHeight > element.clientHeight)
    ).toBe(true)
    const tracksBox = await tracks.boundingBox()
    expect(tracksBox).not.toBeNull()
    await page.mouse.move(
      tracksBox!.x + tracksBox!.width / 2,
      tracksBox!.y + tracksBox!.height / 2
    )
    await page.mouse.wheel(0, 300)
    await expect
      .poll(async () => tracks.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0)
    expect(visible(await imageStates(page), 0.95)[0].index).toBe(initialIndex)

    await page.mouse.click(2, viewport.height / 2)
    await waitForSlideshow(page)
    const previousIndex = visible(await imageStates(page), 0.95)[0].index
    expect(previousIndex).not.toBe(initialIndex)

    await page.mouse.click(viewport.width - 2, viewport.height / 2)
    await waitForSlideshow(page)
    expect(visible(await imageStates(page), 0.95)[0].index).toBe(initialIndex)

    await page.mouse.click(viewport.width / 2, Math.min(80, viewport.height / 4))
    await expect(page.locator(stage)).toHaveClass(/closing/)
    await expect(page.locator(stage)).toHaveClass(/trail/)
  })

  test('navigation keeps its cursor label unless the image is loading', async ({
    page
  }) => {
    await openCollection(page, '/')
    await buildTrail(page, 5)
    await openSlideshow(page)

    const viewport = page.viewportSize()!
    const cursor = page.locator('.cursor')
    const cursorText = cursor.locator('.cursorInner')
    await page.mouse.move(viewport.width - 2, viewport.height / 2)
    const nextText = (await cursorText.textContent())?.trim()
    expect(nextText).not.toBe('')

    await page.mouse.click(viewport.width - 2, viewport.height / 2)
    await expect(page.locator(stage)).toHaveClass(/navigating/)
    await expect(cursor).toHaveClass(/active/)
    await expect(cursor).not.toHaveClass(/suppressed/)
    await expect(cursorText).toHaveText(nextText!)
    await page.mouse.move(viewport.width - 3, viewport.height / 2 + 3)
    await expect(cursor).not.toHaveClass(/suppressed/)
    await expect(cursorText).toHaveText(nextText!)
    await waitForSlideshow(page)

    let releaseImage!: () => void
    const imageGate = new Promise<void>((resolve) => {
      releaseImage = resolve
    })
    await page.route('**/cursor-loading-*.png', async (route) => {
      await imageGate
      await route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XyB7WQAAAABJRU5ErkJggg==',
          'base64'
        )
      })
    })
    await page.locator(images).evaluateAll((elements) => {
      elements.forEach((image, index) => {
        const target = image as HTMLImageElement
        target.dataset.hiUrl = `/cursor-loading-${index}.png`
        Object.defineProperty(target, 'complete', {
          configurable: true,
          get: () => false
        })
      })
    })

    const loadingText = await page.locator('.container').getAttribute('data-loading')
    await page.mouse.move(viewport.width - 2, viewport.height / 2)
    await page.mouse.click(viewport.width - 2, viewport.height / 2)
    await expect(page.locator(stage)).toHaveClass(/navigating/)
    await expect(cursor).toHaveClass(/active/)
    await expect(cursor).not.toHaveClass(/suppressed/)
    await expect(cursorText).toHaveText(loadingText!)

    releaseImage()
    await page.locator(images).evaluateAll((elements) => {
      elements.forEach((image) => {
        Reflect.deleteProperty(image, 'complete')
        image.dispatchEvent(new Event('load'))
      })
    })
    await waitForSlideshow(page)
    await expect(cursorText).toHaveText(nextText!)
  })

  test('track hover shows small contribution tags without text', async ({ page }) => {
    await openCollection(page, '/')
    await buildTrail(page, 5)
    await openSlideshow(page)

    const multiTagTrack = page.locator('.track-item').filter({
      has: page.locator('.track-tags .tag:nth-child(2)')
    })
    for (
      let attempt = 0;
      attempt < 14 && (await multiTagTrack.count()) === 0;
      attempt += 1
    )
      await navigate(page, 'next')

    const track = multiTagTrack.first()
    await expect(track).toBeVisible()
    const tags = track.locator('.track-tags .tag')
    const labels = track.locator('.tag-label')
    expect(await tags.count()).toBeGreaterThan(1)

    await track.locator('.track-name').hover()
    await expect
      .poll(
        async () =>
          await tags.first().evaluate((tag) => tag.getBoundingClientRect().width)
      )
      .toBeGreaterThan(5)
    await expect(tags.first()).toHaveCSS('color', 'rgba(0, 0, 0, 0)')

    await expect(tags.first()).toHaveCSS('color', 'rgba(0, 0, 0, 0)')
    await expect(labels.first()).toHaveCSS('max-width', '0px')
    await expect(labels.first()).toHaveCSS('opacity', '0')

    await page.locator('.project-name').hover()
    await expect(tags.first()).toHaveCSS('color', 'rgba(0, 0, 0, 0)')
  })

  test('clicking anywhere in a row toggles one full track without hover hiding text', async ({
    page
  }) => {
    await openCollection(page, '/')
    await buildTrail(page, 5)
    await openSlideshow(page)

    for (
      let attempt = 0;
      attempt < 14 && (await page.locator('.track-item').count()) < 2;
      attempt += 1
    )
      await navigate(page, 'next')

    const tracks = page.locator('.track-item')
    const first = tracks.nth(0)
    const second = tracks.nth(1)
    const firstTag = first.locator('.track-tags .tag').first()
    const secondTag = second.locator('.track-tags .tag').first()

    const firstBox = await first.boundingBox()
    expect(firstBox).not.toBeNull()
    await page.mouse.move(
      firstBox!.x + firstBox!.width - 4,
      firstBox!.y + firstBox!.height / 2
    )
    await expect
      .poll(async () => firstTag.evaluate((tag) => tag.getBoundingClientRect().width))
      .toBeGreaterThan(5)
    const hoverTagHeight = await firstTag.evaluate(
      (tag) => tag.getBoundingClientRect().height
    )
    await page.mouse.click(
      firstBox!.x + firstBox!.width - 4,
      firstBox!.y + firstBox!.height / 2
    )
    await expect(first).toHaveAttribute('aria-pressed', 'true')
    await expect(first.locator('.tag-label').first()).toHaveCSS('opacity', '0')
    await page.waitForTimeout(120)
    expect(
      await first
        .locator('.tag-label')
        .first()
        .evaluate((label) => label.getBoundingClientRect().width)
    ).toBeGreaterThan(0)
    await expect(first.locator('.tag-label').first()).toHaveCSS('opacity', '0')
    await expect(firstTag).toHaveCSS('color', 'rgb(255, 255, 255)')
    await expect(first.locator('.tag-label').first()).toHaveCSS(
      'color',
      'rgb(255, 255, 255)'
    )
    await expect(first.locator('.tag-label').first()).toHaveCSS('display', 'block')
    await expect(first.locator('.tag-label').first()).toHaveCSS('opacity', '1')
    expect(
      await first
        .locator('.tag-label')
        .first()
        .evaluate((label) => new DOMMatrixReadOnly(getComputedStyle(label).transform).c)
    ).toBeCloseTo(Math.tan((5 * Math.PI) / 180), 5)
    expect(
      await page
        .locator('.contribution-tags .tag-label')
        .first()
        .evaluate((label) => new DOMMatrixReadOnly(getComputedStyle(label).transform).c)
    ).toBeCloseTo(Math.tan((15 * Math.PI) / 180), 5)
    expect(
      await firstTag.evaluate((tag) => tag.getBoundingClientRect().height)
    ).toBeCloseTo(hoverTagHeight, 1)
    await expect
      .poll(async () =>
        first
          .locator('.tag-label')
          .first()
          .evaluate((label) => label.getBoundingClientRect().width)
      )
      .toBeGreaterThan(0)
    await expect(secondTag).toHaveCSS('color', 'rgba(0, 0, 0, 0)')

    await first.locator('.track-name').click()
    await expect(first).toHaveAttribute('aria-pressed', 'false')
    await first.locator('.track-name').click()
    await expect(first).toHaveAttribute('aria-pressed', 'true')
    await expect(first.locator('.tag-label').first()).toHaveCSS('display', 'block')
    await expect
      .poll(async () =>
        first
          .locator('.tag-label')
          .first()
          .evaluate((label) => label.getBoundingClientRect().width)
      )
      .toBeGreaterThan(0)

    await second.locator('.track-name').hover()
    await expect(firstTag).toHaveCSS('color', 'rgb(255, 255, 255)')
    await expect(secondTag).toHaveCSS('color', 'rgba(0, 0, 0, 0)')

    const secondBox = await second.boundingBox()
    expect(secondBox).not.toBeNull()
    await page.mouse.click(
      secondBox!.x + secondBox!.width - 4,
      secondBox!.y + secondBox!.height / 2
    )
    await expect(first).toHaveAttribute('aria-pressed', 'false')
    await expect(second).toHaveAttribute('aria-pressed', 'true')
    await expect(firstTag).toHaveCSS('color', 'rgba(0, 0, 0, 0)')
    await expect(secondTag).toHaveCSS('color', 'rgb(255, 255, 255)')

    await second.locator('.track-name').click()
    await page.locator('.project-name').hover()
    await expect(second).toHaveAttribute('aria-pressed', 'false')
    await expect(secondTag).toHaveCSS('color', 'rgba(0, 0, 0, 0)')
  })

  test('closing shrinks before returning one image to the stage', async ({ page }) => {
    await openCollection(page, '/')
    await buildTrail(page, 5)
    await openSlideshow(page)

    const current = visible(await imageStates(page), 0.95)[0]
    const { frames } = await recordAnimation(page, 1)
    expect(frames.at(-1)!.mode).toContain('trail')
    expect(
      frames.every((frame) => {
        const shown = visible(frame.images)
        return shown.length === 1 && shown[0].index === current.index
      })
    ).toBe(true)

    const shrinkStart = frames.findIndex(
      ({ images: frameImages }) =>
        frameImages[current.index].scale < current.scale - 0.01
    )
    const movementStart = frames.findIndex(({ images: frameImages }) => {
      const image = frameImages[current.index]
      return Math.abs(image.x - current.x) > 1 || Math.abs(image.y - current.y) > 1
    })
    expect(shrinkStart).toBeGreaterThanOrEqual(0)
    expect(movementStart).toBeGreaterThan(shrinkStart)
    expect(frames[movementStart - 1].images[current.index].scale).toBeLessThan(0.61)

    const finalImage = visible(frames.at(-1)!.images, 0.95)[0]
    expect(finalImage.scale).toBeCloseTo(0.6, 2)
  })

  test('navigation serializes rapid pointer and keyboard input', async ({ page }) => {
    await openCollection(page, '/')
    await buildTrail(page, 5)
    await openSlideshow(page)

    const collectionLength = await page.locator(images).count()
    const startingIndex = visible(await imageStates(page), 0.95)[0].index
    await page
      .locator(overlays)
      .nth(2)
      .evaluate((overlay) => {
        ;(overlay as HTMLElement).click()
        ;(overlay as HTMLElement).click()
      })
    await expect(page.locator(stage)).toHaveClass(/navigating/)
    await waitForSlideshow(page)
    expect(visible(await imageStates(page), 0.95)[0].index).toBe(
      (startingIndex + 1) % collectionLength
    )

    await page.keyboard.press('ArrowLeft')
    await expect(page.locator(stage)).toHaveClass(/navigating/)
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Escape')
    await waitForSlideshow(page)
    expect(visible(await imageStates(page), 0.95)[0].index).toBe(startingIndex)

    await page.keyboard.press('Escape')
    await expect(page.locator(stage)).toHaveClass(/closing/)
    await expect(page.locator(stage)).toHaveClass(/trail/)
    expect(visible(await imageStates(page), 0.95)).toHaveLength(1)
  })

  for (const path of ['/', '/webb/']) {
    test(`repeated open, navigate, close, move, and reopen stays clean on ${path}`, async ({
      page
    }) => {
      await openCollection(page, path)
      await buildTrail(page, 5)

      for (let cycle = 0; cycle < 3; cycle += 1) {
        await openSlideshow(page)
        await navigate(page, cycle % 2 === 0 ? 'next' : 'previous')
        await closeSlideshow(page)
        expect(visible(await imageStates(page), 0.95)).toHaveLength(1)

        await page.mouse.move(cycle % 2 === 0 ? 180 : 1080, 220 + cycle * 120)
        await expect
          .poll(async () => visible(await imageStates(page), 0.95).length)
          .toBeGreaterThan(1)
      }
    })
  }

  test('navigation wraps in both directions without exposing stale images', async ({
    page
  }) => {
    test.setTimeout(45_000)
    await openCollection(page, '/')
    await buildTrail(page, 5)
    await openSlideshow(page)

    const collectionLength = await page.locator(images).count()
    const startingIndex = visible(await imageStates(page), 0.95)[0].index
    for (let index = 0; index < collectionLength; index += 1)
      await navigate(page, 'next')
    expect(visible(await imageStates(page), 0.95)[0].index).toBe(startingIndex)

    await navigate(page, 'previous')
    await navigate(page, 'next')
    expect(visible(await imageStates(page), 0.95)[0].index).toBe(startingIndex)
  })

  test('resize preserves a coherent state throughout the lifecycle', async ({
    page
  }) => {
    await openCollection(page, '/')
    await page.setViewportSize({ width: 1200, height: 760 })
    expect(visible(await imageStates(page))).toHaveLength(0)

    await buildTrail(page, 5)
    const trailIndexes = visible(await imageStates(page), 0.95).map(
      ({ index }) => index
    )
    expect(trailIndexes).toHaveLength(5)
    await page.setViewportSize({ width: 1260, height: 780 })
    expect(visible(await imageStates(page), 0.95).map(({ index }) => index)).toEqual(
      trailIndexes
    )

    await page.mouse.down()
    await page.mouse.up()
    await page.waitForTimeout(150)
    await page.setViewportSize({ width: 1360, height: 820 })
    await waitForSlideshow(page)
    expect(visible(await imageStates(page), 0.95)).toHaveLength(1)

    const openIndex = visible(await imageStates(page), 0.95)[0].index
    await page.mouse.click(page.viewportSize()!.width - 2, 100)
    await page.waitForTimeout(100)
    await page.setViewportSize({ width: 1180, height: 740 })
    await waitForSlideshow(page)
    expect(visible(await imageStates(page), 0.95)[0].index).not.toBe(openIndex)

    await page.setViewportSize({ width: 1100, height: 720 })
    expect(visible(await imageStates(page), 0.95)).toHaveLength(1)
    await page.locator(overlays).nth(1).click()
    await page.waitForTimeout(150)
    await page.setViewportSize({ width: 1280, height: 800 })
    await expect.poll(async () => visible(await imageStates(page), 0.95).length).toBe(1)
    await expect(page.locator('.navOverlay')).not.toHaveClass(/active/)
  })

  test('narrow desktop fits the expanded image to its layout area', async ({
    page
  }) => {
    await page.setViewportSize({ width: 853, height: 900 })
    await openCollection(page, '/')
    await buildTrail(page, 5)
    await openSlideshow(page)

    const geometry = await page.evaluate(() => {
      const imageArea = document.querySelector<HTMLElement>('.image-area')!
      const areaBounds = imageArea.getBoundingClientRect()
      const activeImage = Array.from(
        document.querySelectorAll<HTMLImageElement>('.stage img')
      ).find((image) => Number(getComputedStyle(image).opacity) > 0.95)!
      const imageBounds = activeImage.getBoundingClientRect()
      const panel = document.querySelector<HTMLElement>('.panel-container')!
      const panelBounds = panel.getBoundingClientRect()
      return {
        area: { left: areaBounds.left, width: areaBounds.width },
        image: { left: imageBounds.left, width: imageBounds.width },
        panel: {
          backgroundColor: getComputedStyle(panel, '::before').backgroundColor,
          left: panelBounds.left,
          right: panelBounds.right
        }
      }
    })

    expect(geometry.image.width).toBeGreaterThan(853 * 0.5)
    expect(Math.abs(geometry.image.width - geometry.area.width)).toBeLessThanOrEqual(
      0.75
    )
    expect(Math.abs(geometry.image.left - geometry.area.left)).toBeLessThanOrEqual(0.75)
    expect(geometry.panel.left).toBeLessThan(geometry.image.left + geometry.image.width)
    expect(geometry.panel.right).toBeLessThanOrEqual(853)
    expect(geometry.panel.backgroundColor).toBe('rgb(255, 255, 255)')
  })

  test('overlap handoff preserves image and info geometry without a jump', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1200, height: 1375 })
    await openCollection(page, '/')
    await buildTrail(page, 5)
    await openSlideshow(page)

    const readGeometry = async (): Promise<{
      imageTop: number
      imageWidth: number
      infoHeight: number
      infoTop: number
      infoWidth: number
      overlaps: boolean
      releaseTop: number
      rightEdgeNavigatesNext: boolean
    }> =>
      await page.evaluate(() => {
        const image = Array.from(
          document.querySelectorAll<HTMLImageElement>('.stage img')
        ).find((element) => Number(getComputedStyle(element).opacity) > 0.95)!
        const info = document.querySelector<HTMLElement>('.image-info-panel')!
        const imageArea = document.querySelector<HTMLElement>('.image-area')!
        const releaseRow = document.querySelector<HTMLElement>('.artist-section')!
        const imageBounds = image.getBoundingClientRect()
        const infoBounds = info.getBoundingClientRect()
        const rightEdgeTarget = document.elementFromPoint(
          window.innerWidth - 4,
          infoBounds.top + 4
        )
        return {
          imageTop: imageArea.getBoundingClientRect().top,
          imageWidth: imageBounds.width,
          infoHeight: infoBounds.height,
          infoTop: infoBounds.top,
          infoWidth: infoBounds.width,
          overlaps: document
            .querySelector('.stage')!
            .classList.contains('image-info-overlap'),
          releaseTop: releaseRow.getBoundingClientRect().top,
          rightEdgeNavigatesNext:
            rightEdgeTarget?.getAttribute('data-nav-action') === 'next'
        }
      })

    let overlapWidth: number | undefined
    for (let width = 1190; width >= 600; width -= 10) {
      await page.setViewportSize({ width, height: 1375 })
      await page.waitForTimeout(30)
      if ((await readGeometry()).overlaps) {
        overlapWidth = width
        break
      }
    }
    expect(overlapWidth).toBeDefined()

    await page.setViewportSize({ width: overlapWidth! + 10, height: 1375 })
    await expect.poll(async () => (await readGeometry()).overlaps).toBe(false)

    let before = await readGeometry()
    let after: Awaited<ReturnType<typeof readGeometry>> | undefined
    for (let width = overlapWidth! + 9; width >= overlapWidth!; width -= 1) {
      await page.setViewportSize({ width, height: 1375 })
      await page.waitForTimeout(30)
      const current = await readGeometry()
      if (current.overlaps) {
        after = current
        break
      }
      before = current
    }
    expect(after).toBeDefined()

    expect(before.imageTop).toBeLessThan(before.releaseTop - 2)
    expect(after!.imageTop).toBeGreaterThanOrEqual(after!.releaseTop - 2)
    expect(Math.abs(after!.imageWidth - before.imageWidth)).toBeLessThanOrEqual(2)
    expect(Math.abs(after!.infoTop - before.infoTop)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(after!.infoWidth - before.infoWidth)).toBeLessThanOrEqual(1)
    expect(Math.abs(after!.infoHeight - before.infoHeight)).toBeLessThanOrEqual(1)
    expect(after!.rightEdgeNavigatesNext).toBe(true)
  })

  test('wide desktop preserves the established image-info layout', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openCollection(page, '/')
    await buildTrail(page, 5)
    await openSlideshow(page)

    const geometry = await page.evaluate(() => {
      const imageArea = document.querySelector<HTMLElement>('.image-area')!
      const panel = document.querySelector<HTMLElement>('.panel-container')!
      const info = document.querySelector<HTMLElement>('.image-info-panel')!
      const imageBounds = imageArea.getBoundingClientRect()
      const panelBounds = panel.getBoundingClientRect()
      const infoBounds = info.getBoundingClientRect()
      return {
        imageRight: imageBounds.right,
        infoWidth: infoBounds.width,
        panelLeft: panelBounds.left,
        panelWidth: panelBounds.width
      }
    })

    expect(Math.abs(geometry.panelLeft - geometry.imageRight)).toBeLessThanOrEqual(0.5)
    expect(geometry.panelWidth).toBeCloseTo(1440 - geometry.imageRight, 0)
    expect(geometry.infoWidth).toBeGreaterThanOrEqual(400)
    expect(geometry.infoWidth).toBeLessThanOrEqual(480)
  })

  test('narrow desktop keeps its gallery and branding visible above the image', async ({
    page
  }) => {
    for (const width of [640, 427, 320, 240, 180]) {
      await page.setViewportSize({ width, height: 900 })
      await openCollection(page, '/')
      await buildTrail(page, 5)
      await openSlideshow(page)

      await expect(page.locator('.collection')).toHaveCount(0)
      const title = page.locator('.project-name')
      await expect(title).toBeVisible()
      const titleBounds = await title.boundingBox()
      expect(titleBounds).not.toBeNull()
      expect(titleBounds!.x).toBeGreaterThanOrEqual(0)
      expect(titleBounds!.x + titleBounds!.width).toBeLessThanOrEqual(width)
      expect(
        await page
          .locator('.image-info-panel')
          .evaluate((panel) => panel.scrollWidth <= panel.clientWidth)
      ).toBe(true)
      expect(
        await page.locator('nav').evaluate((nav) => {
          const artistBounds = nav.querySelector('.navArtist')!.getBoundingClientRect()
          const linksBounds = nav.querySelector('.links')!.getBoundingClientRect()
          return (
            artistBounds.right <= linksBounds.left &&
            linksBounds.right <= window.innerWidth
          )
        })
      ).toBe(true)

      const image = visible(await imageStates(page), 0.95)[0]
      expect(image.scale).toBeGreaterThan(0)

      await page.mouse.move(width - 2, 450)
      const cursorBounds = await page.locator('.cursorInner').boundingBox()
      expect(cursorBounds).not.toBeNull()
      expect(cursorBounds!.x).toBeGreaterThanOrEqual(0)
      expect(cursorBounds!.x + cursorBounds!.width).toBeLessThanOrEqual(width)
    }
  })
})
