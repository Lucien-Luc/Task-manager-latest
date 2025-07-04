/**
 * Microsoft Azure Configuration
 * Contains the Azure AD application credentials for Microsoft Graph integration
 */


// Make clientId available globally for backward compatibility
window.MICROSOFT_CLIENT_ID = window.MICROSOFT_CONFIG.clientId;

console.log("Microsoft Azure configuration loaded successfully");
