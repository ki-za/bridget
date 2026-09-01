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
  mode: string
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
  for (let index = 0; index < crossings; index += 1) {
    await page.mouse.move(index % 2 === 0 ? 1100 : 120, 160 + (index % 5) * 110)
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
          const frame = {
            images: readImages(),
            mode: document.querySelector(stageSelector)?.className ?? '',
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

    const { frames } = await recordAnimation(page)
    const inactive = orderedTrail.slice(0, -1).map(({ index }) => index)
    const fadeStart = inactive.map((imageIndex) =>
      frames.findIndex(
        ({ images: frameImages }) => frameImages[imageIndex].opacity < 0.95
      )
    )
    expect(fadeStart.every((frameIndex) => frameIndex >= 0)).toBe(true)
    expect(fadeStart).toEqual([...fadeStart].sort((left, right) => left - right))

    const scaleStart = frames.findIndex(
      ({ images: frameImages }) => frameImages[front!.index].scale > 0.61
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
    const frameBeforeScale = frames[scaleStart - 1]
    expect(
      inactive.every((imageIndex) => frameBeforeScale.images[imageIndex].opacity < 0.05)
    ).toBe(true)
    expect(
      frames.slice(0, scaleStart).some(({ images: frameImages }) => {
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

  test('viewport navigation surrounds an interactive, selectable info column', async ({
    page
  }) => {
    await openCollection(page, '/')
    await buildTrail(page, 5)
    await openSlideshow(page)

    const viewport = page.viewportSize()!
    const panel = page.locator('.image-info-panel')
    const panelBox = await panel.boundingBox()
    const infoColumn = page.locator('.image-info-hit-column')
    const columnBox = await infoColumn.boundingBox()
    expect(panelBox).not.toBeNull()
    expect(columnBox).not.toBeNull()

    const hitOwner = await page.evaluate(
      ({ x, y }) => {
        const hit = document.elementFromPoint(x, y)
        return {
          insidePanel: hit?.closest('.image-info-panel') !== null,
          navAction: hit?.closest<HTMLElement>('[data-nav-action]')?.dataset.navAction
        }
      },
      { x: panelBox!.x + panelBox!.width / 2, y: panelBox!.y + panelBox!.height / 2 }
    )
    expect(hitOwner).toEqual({ insidePanel: true, navAction: undefined })
    const emptyColumnOwner = await page.evaluate(
      ({ x, y }) => {
        const hit = document.elementFromPoint(x, y)
        return {
          insideColumn: hit?.closest('.image-info-hit-column') !== null,
          insidePanel: hit?.closest('.image-info-panel') !== null,
          navAction: hit?.closest<HTMLElement>('[data-nav-action]')?.dataset.navAction
        }
      },
      { x: columnBox!.x + columnBox!.width / 2, y: 10 }
    )
    expect(emptyColumnOwner).toEqual({
      insideColumn: true,
      insidePanel: false,
      navAction: undefined
    })
    await expect(panel).toHaveCSS('user-select', 'text')

    const title = panel.locator('.project-name')
    const titleBox = await title.boundingBox()
    expect(titleBox).not.toBeNull()
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
})
