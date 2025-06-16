
async function detectSecurityFeaturesWithBrowser(page) {
  return await page.evaluate(() => {
    const features = [];
    
    // Check for CAPTCHA
    const captchaElements = document.querySelectorAll(
      'img[src*="captcha"], [class*="captcha"], [id*="captcha"], .g-recaptcha, #recaptcha, [data-sitekey]'
    );
    if (captchaElements.length > 0) {
      features.push({
        type: 'captcha',
        details: { count: captchaElements.length, types: ['recaptcha', 'image'] }
      });
    }
    
    // Check for CSRF tokens
    const csrfElements = document.querySelectorAll(
      'input[name*="csrf"], input[name*="token"], meta[name="csrf-token"], meta[name="_token"]'
    );
    if (csrfElements.length > 0) {
      features.push({
        type: 'csrf',
        details: { tokens_found: csrfElements.length }
      });
    }
    
    // Check for MFA fields
    const mfaElements = document.querySelectorAll(
      'input[name*="code"], input[placeholder*="code"], [class*="mfa"], [id*="mfa"], [class*="otp"], [id*="otp"]'
    );
    if (mfaElements.length > 0) {
      features.push({
        type: 'mfa',
        details: { fields_found: mfaElements.length }
      });
    }
    
    // Check for OAuth/SSO buttons
    const oauthElements = document.querySelectorAll(
      '[class*="oauth"], [class*="google"], [class*="facebook"], [class*="microsoft"], [class*="sso"]'
    );
    if (oauthElements.length > 0) {
      features.push({
        type: 'oauth',
        details: { providers_found: oauthElements.length }
      });
    }
    
    return features;
  });
}

function analyzeHtmlForSecurityFeatures(html) {
  const features = [];
  
  // Check for CAPTCHA
  if (html.includes('captcha') || html.includes('recaptcha') || html.includes('data-sitekey')) {
    features.push({
      type: 'captcha',
      details: { detected_in_html: true }
    });
  }
  
  // Check for CSRF
  if (html.includes('csrf') || html.includes('_token')) {
    features.push({
      type: 'csrf',
      details: { detected_in_html: true }
    });
  }
  
  // Check for OAuth
  if (html.includes('oauth') || html.includes('google') || html.includes('facebook')) {
    features.push({
      type: 'oauth',
      details: { detected_in_html: true }
    });
  }
  
  return features;
}

module.exports = {
  detectSecurityFeaturesWithBrowser,
  analyzeHtmlForSecurityFeatures
};
