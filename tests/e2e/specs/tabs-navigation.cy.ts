/// <reference types="cypress" />

// Regression test for the "stuck on Profile tab" bug:
// land on /tabs/tab3, then click the other tab buttons and assert the
// router actually moves. Browser errors are captured and asserted empty.

const errors: string[] = [];

function captureErrors(): void {
  cy.on('unhandledrejection', (err) => {
    errors.push(`unhandledrejection: ${err}`);
  });
  cy.on('window:error', (err) => {
    errors.push(`window:error: ${err.message}`);
  });
}

function loginViaUi(): void {
  cy.visit('/login');
  cy.get('input[aria-label="Email"]', { timeout: 15000 }).should('exist');
  cy.get('input[aria-label="Email"]').type(Cypress.env('QA_EMAIL') as string);
  cy.get('input[aria-label="Password"]').type(Cypress.env('QA_PASSWORD') as string);
  cy.contains('ion-button', 'Sign in').click();
  cy.url({ timeout: 20000 }).should('include', '/tabs/tab1');
  cy.get('.generate-btn', { timeout: 20000 }).should('exist');
}

describe('Tabs navigation', () => {
  before(() => {
    cy.task('seedUser').then((res) => {
      expect(res).to.have.property('ok', true);
    });
  });

  after(() => {
    cy.task('cleanupUser');
  });

  it('switches away from the Profile tab when clicking other tabs', () => {
    captureErrors();
    loginViaUi();

    // Go to Profile (tab3)
    cy.contains('ion-tab-button', 'Profile').click();
    cy.url({ timeout: 15000 }).should('include', '/tabs/tab3');
    cy.contains('ion-title', 'Profile', { timeout: 15000 }).should('be.visible');

    // The bug: clicking Practice (tab1) while on Profile
    cy.contains('ion-tab-button', 'Practice').click();
    cy.url({ timeout: 15000 }).should('include', '/tabs/tab1');
    cy.contains('.generate-btn', 'Generate practice questions', { timeout: 15000 }).should('be.visible');
    cy.contains('ion-title', 'Profile').should('not.be.visible');

    // Now History (tab2)
    cy.contains('ion-tab-button', 'History').click();
    cy.url({ timeout: 15000 }).should('include', '/tabs/tab2');
    cy.contains('ion-title', 'History', { timeout: 15000 }).should('be.visible');

    // And back to Profile once more (round-trip)
    cy.contains('ion-tab-button', 'Profile').click();
    cy.url({ timeout: 15000 }).should('include', '/tabs/tab3');
    cy.contains('ion-title', 'Profile', { timeout: 15000 }).should('be.visible');

    // Everything must have happened without browser errors
    cy.then(() => {
      if (errors.length) {
        cy.log('Captured errors:');
        errors.forEach((e) => cy.log(e));
      }
      expect(errors).to.deep.equal([]);
    });
  });
});