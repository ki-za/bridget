import { expect, test } from '@playwright/test'

const mobileUserAgent =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'

test.use({
  hasTouch: true,
  isMobile: true,
  userAgent: mobileUserAgent,
  viewport: { width: 390, height: 844 }
})

test('tap toggles full contribution labels for only one track', async ({ page }) => {
  await page.goto('/')
  await page.locator('.collection img').nth(4).tap()

  const panel = page.locator('.swiper-slide-active .mobile-image-info')
  await expect(panel).toBeVisible()
  await expect(panel.locator('.project-name')).toHaveText('Live Wire')
  const tracks = panel.locator('.track-item')
  await expect(tracks).toHaveCount(2)

  const first = tracks.nth(0)
  const second = tracks.nth(1)
  const firstTag = first.locator('.track-tags .tag').first()
  const secondTag = second.locator('.track-tags .tag').first()

  await expect(firstTag).toHaveCSS('font-size', '0px')
  await expect
    .poll(async () => firstTag.evaluate((tag) => tag.getBoundingClientRect().width))
    .toBe(0)
  await first.tap()
  await expect(first).toHaveAttribute('aria-pressed', 'true')
  await expect(firstTag).toHaveCSS('font-size', '12px')
  await expect(secondTag).toHaveCSS('font-size', '0px')
  await expect
    .poll(async () => firstTag.evaluate((tag) => tag.getBoundingClientRect().width))
    .toBeGreaterThan(20)

  await second.tap()
  await expect(first).toHaveAttribute('aria-pressed', 'false')
  await expect(second).toHaveAttribute('aria-pressed', 'true')
  await expect(firstTag).toHaveCSS('font-size', '0px')
  await expect(secondTag).toHaveCSS('font-size', '12px')
  await expect
    .poll(async () => firstTag.evaluate((tag) => tag.getBoundingClientRect().width))
    .toBe(0)

  await second.tap()
  await expect(second).toHaveAttribute('aria-pressed', 'false')
  await expect(secondTag).toHaveCSS('font-size', '0px')
  await expect
    .poll(async () => secondTag.evaluate((tag) => tag.getBoundingClientRect().width))
    .toBe(0)
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
  await track.locator('.track-tags').hover()
  await expect(track).toHaveAttribute('aria-pressed', 'true')
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
