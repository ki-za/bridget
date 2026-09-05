import { expect, test } from '@playwright/test'

const mobileUserAgent =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'

test.use({
  hasTouch: true,
  isMobile: true,
  userAgent: mobileUserAgent,
  viewport: { width: 390, height: 844 }
})

test('renders legacy, YouTube Music, and custom project links in order', async ({
  page
}) => {
  await page.route('**/index.json', async (route) => {
    const response = await route.fetch()
    const imageData = (await response.json()) as Array<{
      imageInfo?: Record<string, unknown>
    }>

    for (const image of imageData) {
      if (image.imageInfo === undefined) continue
      Object.assign(image.imageInfo, {
        spotifyLink: 'https://open.spotify.com/album/example',
        appleMusicLink: 'https://music.apple.com/album/example',
        youtubeMusicLink: 'https://music.youtube.com/playlist?list=example',
        customLinks: [
          { label: 'Bandcamp', url: 'https://example.bandcamp.com/release' },
          { label: 'Credits', url: 'https://example.com/credits' }
        ]
      })
    }

    await route.fulfill({ response, json: imageData })
  })

  await page.goto('/')
  await page.locator('.collection img').first().tap()

  const links = page.locator('.swiper-slide-active .external-links a')
  await expect(links).toHaveText([
    'Spotify',
    'Apple Music',
    'YouTube Music',
    'Bandcamp',
    'Credits'
  ])
  await expect(links.nth(2)).toHaveAttribute(
    'href',
    'https://music.youtube.com/playlist?list=example'
  )
  await expect(links.nth(3)).toHaveAttribute(
    'href',
    'https://example.bandcamp.com/release'
  )
  await expect(links.first()).toHaveAttribute('target', '_blank')
  await expect(links.first()).toHaveAttribute('rel', 'noopener noreferrer')
  expect(
    await page
      .locator('.swiper-slide-active .mobile-image-info')
      .evaluate((panel) => panel.scrollWidth <= panel.clientWidth)
  ).toBe(true)
})

test('taps cycle one track through small tags, full labels, and hidden', async ({
  page
}) => {
  await page.goto('/')
  await page.locator('.collection img').nth(4).tap()

  const panel = page.locator('.swiper-slide-active .mobile-image-info')
  await expect(panel).toBeVisible()
  await expect(panel.locator('.project-name')).toHaveText('Live Wire')
  const tracks = panel.locator('.track-item')
  await expect(tracks).toHaveCount(2)
  await expect(panel.locator('.track-scrollbar')).not.toHaveClass(
    /track-scrollbar--visible/
  )

  const first = tracks.nth(0)
  const second = tracks.nth(1)
  const firstTag = first.locator('.track-tags .tag').first()
  const secondTag = second.locator('.track-tags .tag').first()

  await expect(first).toHaveAttribute('data-tag-state', 'hidden')
  await expect(firstTag).toHaveCSS('font-size', '0px')
  await expect
    .poll(async () => firstTag.evaluate((tag) => tag.getBoundingClientRect().width))
    .toBe(0)

  const previewWidths = await first.evaluate(async (track) => {
    const tag = track.querySelector<HTMLElement>('.track-tags .tag')!
    track.click()
    const widths = [tag.getBoundingClientRect().width]
    for (let frame = 0; frame < 16; frame += 1) {
      await new Promise(requestAnimationFrame)
      widths.push(tag.getBoundingClientRect().width)
    }
    return widths
  })
  await expect(first).toHaveAttribute('aria-pressed', 'true')
  await expect(first).toHaveAttribute('data-tag-state', 'small')
  expect(previewWidths[0]).toBeLessThan(1)
  expect(
    previewWidths.some(
      (width) => width > 1 && width < previewWidths[previewWidths.length - 1]! - 1
    )
  ).toBe(true)
  await expect(firstTag).toHaveCSS('font-size', '0px')
  await expect(firstTag.locator('.tag-label')).toHaveCSS('opacity', '0')
  await expect
    .poll(async () => firstTag.evaluate((tag) => tag.getBoundingClientRect().width))
    .toBeGreaterThan(5)

  const smallTagWidth = await firstTag.evaluate(
    (tag) => tag.getBoundingClientRect().width
  )
  const expansionWidths = await first.evaluate(async (track) => {
    const tag = track.querySelector<HTMLElement>('.track-tags .tag')!
    track.click()
    const widths = [tag.getBoundingClientRect().width]
    for (let frame = 0; frame < 8; frame += 1) {
      await new Promise(requestAnimationFrame)
      widths.push(tag.getBoundingClientRect().width)
    }
    return widths
  })
  await expect(first).toHaveAttribute('data-tag-state', 'full')
  expect(Math.min(...expansionWidths)).toBeGreaterThanOrEqual(smallTagWidth - 1)
  await expect(firstTag).toHaveCSS('font-size', '12px')
  await expect(secondTag).toHaveCSS('font-size', '0px')
  await expect
    .poll(async () => firstTag.evaluate((tag) => tag.getBoundingClientRect().width))
    .toBeGreaterThan(20)

  await second.tap()
  await expect(first).toHaveAttribute('aria-pressed', 'false')
  await expect(first).toHaveAttribute('data-tag-state', 'hidden')
  await expect(second).toHaveAttribute('aria-pressed', 'true')
  await expect(second).toHaveAttribute('data-tag-state', 'small')
  await expect(firstTag).toHaveCSS('font-size', '0px')
  await expect(secondTag).toHaveCSS('font-size', '0px')
  await expect
    .poll(async () => firstTag.evaluate((tag) => tag.getBoundingClientRect().width))
    .toBe(0)

  await second.tap()
  await expect(second).toHaveAttribute('data-tag-state', 'full')
  await expect(secondTag).toHaveCSS('font-size', '12px')

  await second.tap()
  await expect(second).toHaveAttribute('aria-pressed', 'false')
  await expect(second).toHaveAttribute('data-tag-state', 'hidden')
  await expect(secondTag).toHaveCSS('font-size', '0px')
  await expect
    .poll(async () => secondTag.evaluate((tag) => tag.getBoundingClientRect().width))
    .toBe(0)
})

test('overflowing track list keeps a visible scroll indicator', async ({ page }) => {
  await page.goto('/')
  await page.locator('.collection img').nth(2).tap()

  const panel = page.locator('.swiper-slide-active .mobile-image-info')
  await expect(panel.locator('.project-name')).toHaveText('Electric Drive')
  const tracks = panel.locator('.track-items')
  const scrollbar = tracks.locator('.track-scrollbar')

  expect(
    await tracks.evaluate((element) => element.scrollHeight > element.clientHeight)
  ).toBe(true)
  await expect(scrollbar).toHaveClass(/track-scrollbar--visible/)
  await expect(scrollbar).toHaveCSS('width', '4px')
  await expect(tracks).toHaveCSS('scrollbar-width', 'none')
  expect(
    await tracks.evaluate(
      (element) => getComputedStyle(element, '::-webkit-scrollbar').display
    )
  ).toBe('none')
  const initialBox = await scrollbar.boundingBox()
  expect(initialBox).not.toBeNull()

  await tracks.evaluate((element) => {
    element.scrollTop = 100
  })
  await expect
    .poll(async () => (await scrollbar.boundingBox())?.y)
    .toBeGreaterThan(initialBox!.y)
})

test('hover-capable mobile layout keeps selected tag text visible', async ({
  browser
}) => {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173',
    hasTouch: false,
    userAgent: mobileUserAgent,
    viewport: { width: 900, height: 700 }
  })
  const page = await context.newPage()
  await page.goto('/')
  await page.locator('.collection img').nth(4).click()

  const panel = page.locator('.swiper-slide-active .mobile-image-info')
  await expect(panel.locator('.project-name')).toHaveText('Live Wire')
  const track = panel.locator('.track-item').first()
  const tag = track.locator('.track-tags .tag').first()
  const label = tag.locator('.tag-label')

  await track.hover()
  await expect
    .poll(async () => tag.evaluate((element) => element.getBoundingClientRect().width))
    .toBe(0)

  await track.locator('.track-name').click()
  await expect(track).toHaveAttribute('data-tag-state', 'small')
  await track.locator('.track-name').click()
  await track.locator('.track-tags').hover()
  await expect(track).toHaveAttribute('aria-pressed', 'true')
  await expect(track).toHaveAttribute('data-tag-state', 'full')
  await expect(tag).toHaveCSS('color', 'rgb(255, 255, 255)')
  await expect(label).toHaveCSS('color', 'rgb(255, 255, 255)')
  await expect(label).toHaveCSS('display', 'block')
  await expect
    .poll(async () =>
      label.evaluate((element) => element.getBoundingClientRect().width)
    )
    .toBeGreaterThan(0)

  await context.close()
})
