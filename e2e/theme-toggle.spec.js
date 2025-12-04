// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Theme Toggle E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the login page where theme toggle is visible
    await page.goto('/');
    
    // Clear localStorage to ensure a clean state
    await page.evaluate(() => {
      localStorage.removeItem('bruinlm-theme');
    });
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('theme toggle button is visible on login page', async ({ page }) => {
    // Find the theme toggle button by its title attribute
    // The button has title="Switch to dark mode" or title="Switch to light mode"
    const themeToggle = page.locator('button[title*="Switch to"]');
    
    // Assert that the theme toggle button is visible
    await expect(themeToggle).toBeVisible();
  });

  test('clicking theme toggle switches from light to dark mode', async ({ page }) => {
    // Find the theme toggle button by its title attribute
    const themeToggle = page.locator('button[title*="Switch to"]');
    
    // Get initial theme from localStorage (might be light or dark based on system preference)
    const initialTheme = await page.evaluate(() => {
      return localStorage.getItem('bruinlm-theme');
    });
    
    // Get initial button title
    const initialTitle = await themeToggle.getAttribute('title');
    const isInitiallyDark = initialTitle === 'Switch to light mode';
    
    // Click the theme toggle button
    await themeToggle.click();
    
    // Wait for the theme to update (React state update)
    await page.waitForTimeout(300);
    
    // Verify localStorage changed
    const newTheme = await page.evaluate(() => {
      return localStorage.getItem('bruinlm-theme');
    });
    
    // Verify theme was toggled
    if (isInitiallyDark) {
      expect(newTheme).toBe('light');
    } else {
      expect(newTheme).toBe('dark');
    }
    
    // Verify button title changed
    const newTitle = await themeToggle.getAttribute('title');
    if (isInitiallyDark) {
      expect(newTitle).toBe('Switch to dark mode');
    } else {
      expect(newTitle).toBe('Switch to light mode');
    }
  });

  test('theme toggle persists across page reloads', async ({ page }) => {
    // Find and click the theme toggle to switch to dark mode
    const themeToggle = page.locator('button[title*="Switch to"]');
    
    const initialTitle = await themeToggle.getAttribute('title');
    const shouldToggle = initialTitle === 'Switch to dark mode';
    
    if (shouldToggle) {
      // Switch to dark mode
      await themeToggle.click();
      await page.waitForTimeout(300);
    }
    
    // Verify theme is saved in localStorage
    const savedTheme = await page.evaluate(() => {
      return localStorage.getItem('bruinlm-theme');
    });
    expect(savedTheme).toBeTruthy();
    
    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Verify theme persists after reload
    const themeAfterReload = await page.evaluate(() => {
      return localStorage.getItem('bruinlm-theme');
    });
    expect(themeAfterReload).toBe(savedTheme);
    
    // Verify button title matches persisted theme
    const themeToggleAfterReload = page.locator('button[title*="Switch to"]');
    const titleAfterReload = await themeToggleAfterReload.getAttribute('title');
    
    if (savedTheme === 'dark') {
      expect(titleAfterReload).toBe('Switch to light mode');
    } else {
      expect(titleAfterReload).toBe('Switch to dark mode');
    }
  });

  test('theme toggle works in both directions (light ↔ dark)', async ({ page }) => {
    const themeToggle = page.locator('button[title*="Switch to"]');
    
    // Get initial state
    const initialTitle = await themeToggle.getAttribute('title');
    const initialTheme = await page.evaluate(() => {
      return localStorage.getItem('bruinlm-theme');
    });
    
    // First toggle
    await themeToggle.click();
    await page.waitForTimeout(300);
    
    const afterFirstToggle = await page.evaluate(() => {
      return localStorage.getItem('bruinlm-theme');
    });
    const titleAfterFirst = await themeToggle.getAttribute('title');
    
    // Verify it toggled
    expect(afterFirstToggle).not.toBe(initialTheme);
    
    // Second toggle (should go back)
    await themeToggle.click();
    await page.waitForTimeout(300);
    
    const afterSecondToggle = await page.evaluate(() => {
      return localStorage.getItem('bruinlm-theme');
    });
    const titleAfterSecond = await themeToggle.getAttribute('title');
    
    // Verify it toggled back to original
    expect(titleAfterSecond).toBe(initialTitle);
  });

  test('theme toggle changes page background color', async ({ page }) => {
    const themeToggle = page.locator('button[title*="Switch to"]');
    
    // Get initial background color from the main container
    const initialBackgroundColor = await page.evaluate(() => {
      const container = document.querySelector('div[style*="background"]');
      return container ? window.getComputedStyle(container).backgroundColor : 
             window.getComputedStyle(document.body).backgroundColor;
    });
    
    // Click to toggle theme
    await themeToggle.click();
    await page.waitForTimeout(500); // Wait for transition
    
    // Get new background color
    const newBackgroundColor = await page.evaluate(() => {
      const container = document.querySelector('div[style*="background"]');
      return container ? window.getComputedStyle(container).backgroundColor : 
             window.getComputedStyle(document.body).backgroundColor;
    });
    
    // Verify background color changed (exact colors depend on your theme, 
    // but we can verify they're different)
    expect(newBackgroundColor).not.toBe(initialBackgroundColor);
  });
});

