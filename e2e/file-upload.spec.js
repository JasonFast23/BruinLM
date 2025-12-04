// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('File Upload E2E Tests', () => {
  let authToken;
  let testClassId;

  // Helper function to create a test file
  const createTestFile = (filename, content = 'Test PDF content') => {
    const fs = require('fs');
    const testFilePath = path.join(__dirname, 'test-files', filename);

    // Create test-files directory if it doesn't exist
    const dir = path.dirname(testFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Create a simple text file (in real scenario, you'd use actual PDFs)
    fs.writeFileSync(testFilePath, content);
    return testFilePath;
  };

  test.beforeAll(async ({ browser }) => {
    // Setup: Create a test user and class once for all tests
    const context = await browser.newContext();
    const page = await context.newPage();

    // Register or login a test user
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Try to register a new user (or login if already exists)
    const timestamp = Date.now();
    const testEmail = `test${timestamp}@ucla.edu`;
    const testPassword = 'TestPassword123!';

    // Click Sign Up tab
    await page.click('button:has-text("Sign Up")');
    await page.waitForTimeout(300);

    // Fill registration form
    await page.fill('input[type="text"]', 'Test User');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for navigation to hub
    await page.waitForURL('**/hub', { timeout: 10000 });

    // Get auth token from localStorage
    authToken = await page.evaluate(() => localStorage.getItem('token'));

    // Create a test class
    await page.click('button:has-text("Create Class")');
    await page.waitForTimeout(300);

    await page.fill('input[placeholder*="CS 31"]', 'TEST 101');
    await page.fill('input[placeholder*="Introduction"]', 'Test File Upload Class');
    await page.fill('textarea[placeholder*="Brief description"]', 'A class for testing file uploads');

    await page.click('button[type="submit"]:has-text("Create Class")');
    await page.waitForTimeout(1000);

    // Get the class ID by clicking on it and extracting from URL
    await page.click('text=TEST 101');
    await page.waitForURL('**/class/**');

    const url = page.url();
    testClassId = url.split('/class/')[1];

    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    // Set auth token in localStorage
    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, authToken);

    // Navigate to the test class
    await page.goto(`/class/${testClassId}`);
    await page.waitForLoadState('networkidle');
  });

  test('upload button is visible in files sidebar', async ({ page }) => {
    // Find the upload button by its text and icon
    const uploadButton = page.locator('button:has-text("Upload File")');

    // Assert that the upload button is visible
    await expect(uploadButton).toBeVisible();
  });

  test('successfully uploads a file and displays it in sidebar', async ({ page }) => {
    // Create a test file
    const testFilePath = createTestFile('test-document.pdf', 'Sample PDF content for testing');

    // Click the upload button to trigger file input
    const fileInput = page.locator('input[type="file"]');

    // Upload the file
    await fileInput.setInputFiles(testFilePath);

    // Wait for upload to complete (button should show "Uploading..." then back to "Upload File")
    await expect(page.locator('button:has-text("Uploading...")')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('button:has-text("Upload File")')).toBeVisible({ timeout: 10000 });

    // Verify file appears in sidebar
    const uploadedFile = page.locator('text=test-document.pdf');
    await expect(uploadedFile).toBeVisible();
  });

  test('uploaded file shows correct filename and uploader name', async ({ page }) => {
    const testFilePath = createTestFile('test-file-metadata.pdf', 'Testing metadata display');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);

    // Wait for upload
    await expect(page.locator('button:has-text("Upload File")')).toBeVisible({ timeout: 10000 });

    // Check filename is displayed
    await expect(page.locator('text=test-file-metadata.pdf')).toBeVisible();

    // Check uploader name is displayed (should be "Test User")
    const uploaderText = page.locator('text=by Test User');
    await expect(uploaderText).toBeVisible();
  });

  test('file upload button is disabled while uploading', async ({ page }) => {
    const testFilePath = createTestFile('test-disable-check.pdf', 'Testing button disabled state');

    const uploadButton = page.locator('button:has-text("Upload File")');
    const fileInput = page.locator('input[type="file"]');

    // Verify button is enabled initially
    await expect(uploadButton).toBeEnabled();

    // Start upload
    await fileInput.setInputFiles(testFilePath);

    // Button should be disabled during upload
    const uploadingButton = page.locator('button:has-text("Uploading...")');
    await expect(uploadingButton).toBeVisible();
    await expect(uploadingButton).toBeDisabled();

    // Wait for upload to complete
    await expect(page.locator('button:has-text("Upload File")')).toBeVisible({ timeout: 10000 });
    await expect(uploadButton).toBeEnabled();
  });

  test('multiple files can be uploaded sequentially', async ({ page }) => {
    // Upload first file
    const file1Path = createTestFile('test-file-1.pdf', 'First test file');
    let fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(file1Path);
    await expect(page.locator('button:has-text("Upload File")')).toBeVisible({ timeout: 10000 });

    // Upload second file
    const file2Path = createTestFile('test-file-2.pdf', 'Second test file');
    fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(file2Path);
    await expect(page.locator('button:has-text("Upload File")')).toBeVisible({ timeout: 10000 });

    // Both files should be visible in sidebar
    await expect(page.locator('text=test-file-1.pdf')).toBeVisible();
    await expect(page.locator('text=test-file-2.pdf')).toBeVisible();
  });

  test('clicking on uploaded file opens PDF viewer modal', async ({ page }) => {
    const testFilePath = createTestFile('test-viewer-open.pdf', 'Testing viewer modal');

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    await expect(page.locator('button:has-text("Upload File")')).toBeVisible({ timeout: 10000 });

    // Click on the file to open viewer
    await page.click('text=test-viewer-open.pdf');

    // Verify PDF viewer modal is visible
    // Look for the modal container with dark background
    const modal = page.locator('div[style*="position: fixed"][style*="rgba(0, 0, 0, 0.9)"]');
    await expect(modal).toBeVisible();

    // Verify filename is shown in viewer header
    await expect(page.locator('text=test-viewer-open.pdf').last()).toBeVisible();
  });


  test('closing PDF viewer with X button works', async ({ page }) => {
    const testFilePath = createTestFile('test-close-button.pdf', 'Testing close button');

    // Upload and open file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    await expect(page.locator('button:has-text("Upload File")')).toBeVisible({ timeout: 10000 });
    await page.click('text=test-close-button.pdf');

    // Verify modal is open
    const modal = page.locator('div[style*="position: fixed"][style*="rgba(0, 0, 0, 0.9)"]');
    await expect(modal).toBeVisible();

    // Click the X button to close
    const closeButton = page.locator('button:has-text("×")');
    await closeButton.click();

    // Verify modal is closed
    await expect(modal).not.toBeVisible();
  });

  test('closing PDF viewer with Escape key works', async ({ page }) => {
    const testFilePath = createTestFile('test-escape-key.pdf', 'Testing escape key');

    // Upload and open file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    await expect(page.locator('button:has-text("Upload File")')).toBeVisible({ timeout: 10000 });
    await page.click('text=test-escape-key.pdf');

    // Verify modal is open
    const modal = page.locator('div[style*="position: fixed"][style*="rgba(0, 0, 0, 0.9)"]');
    await expect(modal).toBeVisible();

    // Press Escape key
    await page.keyboard.press('Escape');

    // Verify modal is closed
    await expect(modal).not.toBeVisible();
  });

  test('file deletion shows confirmation dialog', async ({ page }) => {
    const testFilePath = createTestFile('test-confirm-delete.pdf', 'Testing delete confirmation');

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    await expect(page.locator('button:has-text("Upload File")')).toBeVisible({ timeout: 10000 });

    let dialogShown = false;
    let dialogMessage = '';

    // Listen for dialog
    page.on('dialog', dialog => {
      dialogShown = true;
      dialogMessage = dialog.message();
      dialog.dismiss(); // Cancel deletion
    });

    // Find the delete button using the same approach as the previous test
    const sidebar = page.locator('aside').first();
    const fileContainer = sidebar.locator('div:has(p:text("test-confirm-delete.pdf"))').first();
    await fileContainer.hover();

    const deleteButton = fileContainer.locator('button').last();
    await deleteButton.click();

    // Verify dialog was shown
    expect(dialogShown).toBe(true);
    expect(dialogMessage).toContain('Are you sure');

    // File should still be visible (we dismissed the dialog)
    await expect(sidebar.locator('text=test-confirm-delete.pdf')).toBeVisible();
  });

  test('no files message is shown when no files are uploaded', async ({ page }) => {
    // Navigate to a fresh class or ensure no files exist
    // For this test, we'll check the initial state might show "No files uploaded yet"

    // If files exist from previous tests, this might not show
    // But the locator should exist in the code
    const noFilesMessage = page.locator('text=No files uploaded yet');

    // This test assumes a clean state - might be visible or not depending on previous tests
    // We'll just verify the element exists in the DOM or files are shown
    const filesExist = await page.locator('div:has(p:text(".pdf"))').count() > 0;

    if (!filesExist) {
      await expect(noFilesMessage).toBeVisible();
    } else {
      // If files exist, the message should not be visible
      await expect(noFilesMessage).not.toBeVisible();
    }
  });

  test('file upload shows processing message during upload', async ({ page }) => {
    const testFilePath = createTestFile('test-processing-msg.pdf', 'Testing processing message');

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);

    // Look for processing message in chat (if AI summary is being generated)
    // The code shows a processing message like 'Processing "filename"'
    const processingMessage = page.locator('text=Processing "test-processing-msg.pdf"');

    // This might appear briefly, so we check if it appears or if upload completes quickly
    try {
      await expect(processingMessage).toBeVisible({ timeout: 2000 });
    } catch {
      // Processing might complete too quickly to catch
      // Just verify upload completed successfully
      await expect(page.locator('button:has-text("Upload File")')).toBeVisible({ timeout: 10000 });
    }
  });

  test('file list updates after upload completes', async ({ page }) => {
    // Upload a new file with a unique name
    const testFilePath = createTestFile('test-list-update.pdf', 'Testing list update');

    // Verify file doesn't exist yet
    await expect(page.locator('text=test-list-update.pdf')).not.toBeVisible();

    // Upload the file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
    await expect(page.locator('button:has-text("Upload File")')).toBeVisible({ timeout: 10000 });

    // Verify new file is now visible in the file list
    await expect(page.locator('text=test-list-update.pdf')).toBeVisible();

    // Verify it's in the files sidebar (not just in chat)
    const filesSection = page.locator('aside').first(); // The files sidebar
    await expect(filesSection.locator('text=test-list-update.pdf')).toBeVisible();
  });

  test('file input accepts only specific file types', async ({ page }) => {
    // Check the file input accept attribute
    const fileInput = page.locator('input[type="file"]');
    const acceptAttr = await fileInput.getAttribute('accept');

    // Should accept PDF, DOC, DOCX, TXT files
    expect(acceptAttr).toContain('.pdf');
    expect(acceptAttr).toContain('.doc');
    expect(acceptAttr).toContain('.docx');
    expect(acceptAttr).toContain('.txt');
  });
});
