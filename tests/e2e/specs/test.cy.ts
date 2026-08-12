describe('Authentication', () => {
  it('renders the HirePath login screen', () => {
    cy.visit('/login')
    cy.contains('h1', 'HirePath')
    cy.contains('Sign in')
  })
})
