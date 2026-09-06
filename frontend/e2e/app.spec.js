import { test, expect } from '@playwright/test'

test('visitor can inspect, step, play, pause, and reset without a backend', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page).toHaveTitle('Tesseract — Four-dimensional chess')
  await expect(page.getByRole('button', { name: 'Play simulation' })).toBeEnabled()
  await expect(page.getByTestId('ply')).toHaveText('000')
  await page.getByRole('button', { name: '(4, 0, 0, 0) white King', exact: true }).click()
  await expect(page.getByText('Ivory king', { exact: true })).toBeVisible()
  await page.getByLabel('Z plane').selectOption('7')
  await page.getByLabel('W plane').selectOption('7')
  await expect(page.getByLabel('Follow move')).not.toBeChecked()
  await expect(
    page.getByRole('button', { name: '(4, 7, 7, 7) black King', exact: true }),
  ).toBeVisible()
  await page.getByLabel('Follow move').check()
  // The loaded application must keep working without a network connection.
  await page.context().setOffline(true)
  await page.getByRole('button', { name: 'Advance one move' }).click()
  await expect(page.getByTestId('ply')).toHaveText('001')
  await expect(page.getByText('Copper to move', { exact: true })).toBeVisible()
  await page.getByLabel('Pace').selectOption('450')
  await page.getByRole('button', { name: 'Play simulation' }).click()
  await expect(page.getByTestId('ply')).not.toHaveText('001')
  await page.getByRole('button', { name: 'Pause', exact: false }).click()
  await expect(page.getByRole('button', { name: 'Advance one move' })).toBeEnabled()
  const ply = await page.getByTestId('ply').textContent()
  await page.waitForTimeout(900)
  await expect(page.getByTestId('ply')).toHaveText(ply)
  await page.getByRole('button', { name: 'Reset simulation' }).click()
  await expect(page.getByTestId('ply')).toHaveText('000')
  await expect(page.getByText('Ivory to move', { exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('display, explanation, immersive view, and responsive layout work', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Play simulation' })).toBeEnabled()
  await expect(page.getByRole('switch', { name: 'Rotate through 4D' })).not.toBeChecked()
  await page.getByRole('switch', { name: 'Attack pressure' }).check()
  await page.getByRole('switch', { name: 'Coordinate lattice' }).uncheck()
  await page.getByRole('button', { name: 'The experiment' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Close explanation' }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.getByRole('button', { name: 'Enter immersive view' }).click()
  await expect(page.locator('.app')).toHaveClass('app immersive')
  await page.getByRole('button', { name: 'Exit immersive view' }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.getByRole('switch', { name: 'Attack pressure' }).uncheck()
  await page.getByRole('switch', { name: 'Coordinate lattice' }).check()
  await page.screenshot({
    path: `test-results/tesseract-${test.info().project.name}.png`,
    fullPage: true,
  })
})

test('reset invalidates any in-flight step', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Advance one move' })).toBeEnabled()
  await page.getByRole('button', { name: 'Advance one move' }).click()
  await page.getByRole('button', { name: 'Reset simulation' }).click()
  await expect(page.getByRole('button', { name: 'Advance one move' })).toBeEnabled()
  await expect(page.getByTestId('ply')).toHaveText('000')
  await page.waitForTimeout(500)
  await expect(page.getByTestId('ply')).toHaveText('000')
})
