import fs from 'node:fs/promises'

import { expect, test } from '@playwright/test'

interface TraceEvent {
  dur?: number
  name?: string
  ts?: number
}

const enabled = process.env.PROFILE_FINAL_ZOOM === '1'

test.use({ trace: 'off', viewport: { width: 2322, height: 1010 } })
test.skip(!enabled, 'Run with PROFILE_FINAL_ZOOM=1 to capture a compositor trace')

test('final-zoom-image-raster stays inside the frame budget', async ({
  page
}, testInfo) => {
  test.setTimeout(60_000)
  await page.addInitScript(() => sessionStorage.setItem('thresholdsIndex', '2'))

  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  await page.goto('/')
  await page.mouse.move(20, 120)
  await page.waitForTimeout(300)
  for (let index = 0; index < 7; index += 1) {
    await page.mouse.move(index % 2 === 0 ? 1500 : 160, 180 + (index % 5) * 130)
    await page.waitForTimeout(35)
  }

  const activeImage = page.locator('.stage img').filter({ visible: true }).last()
  const imageBox = await activeImage.boundingBox()
  expect(imageBox).not.toBeNull()
  expect(Math.abs(imageBox!.width - imageBox!.height)).toBeLessThan(1)

  const traceEvents: TraceEvent[] = []
  cdp.on('Tracing.dataCollected', ({ value }) => traceEvents.push(...value))
  const tracingComplete = new Promise<void>((resolve) => {
    cdp.once('Tracing.tracingComplete', () => resolve())
  })
  await cdp.send('Tracing.start', {
    categories: [
      '-*',
      'devtools.timeline',
      'disabled-by-default-devtools.timeline',
      'disabled-by-default-devtools.timeline.frame',
      'blink',
      'blink.user_timing',
      'loading',
      'cc',
      'gpu'
    ].join(','),
    options: 'record-as-much-as-possible'
  })

  const frameIntervals = await page.evaluate(async () => {
    const stage = document.querySelector<HTMLElement>('.stage')
    const overlay = document.querySelector('.navOverlay')
    if (stage === null || overlay === null) throw new Error('gallery did not mount')
    const images = Array.from(stage.querySelectorAll<HTMLImageElement>('img'))
    const activeImage = images.reduce((front, image) =>
      Number(getComputedStyle(image).zIndex) > Number(getComputedStyle(front).zIndex)
        ? image
        : front
    )

    stage.click()
    return await new Promise<number[]>((resolve) => {
      const intervals: number[] = []
      let previous: number | undefined
      let zoomStarted = false
      const sample = (now: number): void => {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(activeImage).transform)
        if (matrix.a > 0.6001) zoomStarted = true
        if (zoomStarted && previous !== undefined) intervals.push(now - previous)
        previous = now
        if (overlay.classList.contains('active')) {
          performance.mark('zoom-expanded')
          resolve(intervals)
        } else requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
  })

  await page.waitForTimeout(100)
  await cdp.send('Tracing.end')
  await tracingComplete

  const expandedAt = traceEvents.find((event) => event.name === 'zoom-expanded')?.ts
  expect(expandedAt, 'zoom-expanded trace marker is missing').toBeDefined()
  const postCompletionRaster = traceEvents.filter(
    (event) =>
      event.name === 'RasterTask' &&
      event.ts !== undefined &&
      event.ts >= expandedAt! &&
      event.ts <= expandedAt! + 50_000
  )
  const rasterWorkMs =
    postCompletionRaster.reduce((total, event) => total + (event.dur ?? 0), 0) / 1000
  const rasterSettledMs = Math.max(
    0,
    ...postCompletionRaster.map(
      (event) => ((event.ts ?? expandedAt!) + (event.dur ?? 0) - expandedAt!) / 1000
    )
  )
  const maxFrameIntervalMs = Math.max(...frameIntervals)
  const tracePath = testInfo.outputPath('final-zoom-trace.json')
  await fs.writeFile(tracePath, JSON.stringify({ traceEvents }))

  console.log(
    JSON.stringify({
      diagnostic: 'final-zoom-image-raster',
      maxFrameIntervalMs,
      postCompletionRasterTasks: postCompletionRaster.length,
      rasterWorkMs,
      rasterSettledMs,
      tracePath
    })
  )

  expect(maxFrameIntervalMs, 'final zoom dropped a sampled frame').toBeLessThan(20)
  expect(
    postCompletionRaster.length,
    'square image or atomically revealed panel regressed to viewport size'
  ).toBeLessThanOrEqual(40)
  expect(rasterWorkMs, 'final image raster exceeded the worker budget').toBeLessThan(12)
  expect(rasterSettledMs, 'final image tiles missed the completion frame').toBeLessThan(
    20
  )
})
