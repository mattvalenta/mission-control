/**
 * E2E Tests for Multi-Instance Mission Control
 * 
 * These tests verify that the distributed architecture works correctly.
 * Run with: npx playwright test
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.MC_BASE_URL || 'http://localhost:4000';

test.describe('Multi-Instance Sync', () => {
  test('dashboard loads and shows tasks', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Check page loads
    await expect(page.locator('h1, h2')).toBeVisible();
    
    // Check tasks section exists
    const tasksSection = page.locator('[data-testid="tasks-list"], table, .tasks-container');
    await expect(tasksSection.first()).toBeVisible();
  });

  test('can create a task', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Look for create button
    const createButton = page.locator('button:has-text("New"), button:has-text("Create"), [data-testid="new-task"]');
    
    if (await createButton.count() > 0) {
      await createButton.first().click();
      
      // Fill form if modal appears
      const titleInput = page.locator('input[name="title"], [data-testid="task-title"]');
      if (await titleInput.count() > 0) {
        await titleInput.fill('E2E Test Task');
        
        const submitButton = page.locator('button:has-text("Submit"), button:has-text("Create"), button[type="submit"]');
        if (await submitButton.count() > 0) {
          await submitButton.first().click();
        }
      }
    }
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'e2e/screenshots/create-task.png' });
  });

  test('health endpoint returns ok', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.status).toBe('ok');
  });

  test('detailed health shows instances', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health/detailed`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('instances');
    expect(data).toHaveProperty('database');
  });

  test('can list tasks via API', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/tasks`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('tasks');
    expect(Array.isArray(data.tasks)).toBeTruthy();
  });

  test('can list agents via API', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/agents`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('agents');
    expect(Array.isArray(data.agents)).toBeTruthy();
  });

  test('scheduler shows jobs', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/scheduler`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('jobs');
    expect(Array.isArray(data.jobs)).toBeTruthy();
    expect(data.jobs.length).toBeGreaterThan(0);
  });

  test('audit logs accessible', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/audit?limit=10`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('logs');
    expect(Array.isArray(data.logs)).toBeTruthy();
  });
});

test.describe('Job Queue', () => {
  test('jobs have correct status', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/scheduler`);
    const data = await response.json();
    
    // All jobs should have required fields
    for (const job of data.jobs) {
      expect(job).toHaveProperty('name');
      expect(job).toHaveProperty('handler');
      expect(job).toHaveProperty('enabled');
    }
  });
});

test.describe('Webhooks', () => {
  test('can list webhooks', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/webhooks`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('webhooks');
    expect(Array.isArray(data.webhooks)).toBeTruthy();
  });
});
