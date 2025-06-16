
function analyzeInputElement(input) {
  const type = input.type?.toLowerCase() || 'text';
  const name = input.name?.toLowerCase() || '';
  const id = input.id?.toLowerCase() || '';
  const placeholder = input.placeholder?.toLowerCase() || '';
  const className = input.className?.toLowerCase() || '';
  const ariaLabel = input.getAttribute('aria-label')?.toLowerCase() || '';
  
  let fieldType = 'other';
  
  // Password field detection
  if (type === 'password') {
    fieldType = 'password';
  }
  // Email field detection - expanded patterns
  else if (type === 'email' || 
           name.includes('email') || name.includes('mail') ||
           id.includes('email') || id.includes('mail') ||
           placeholder.includes('email') || placeholder.includes('mail') ||
           className.includes('email') || className.includes('mail') ||
           ariaLabel.includes('email') || ariaLabel.includes('mail')) {
    fieldType = 'email';
  }
  // Username field detection - expanded patterns
  else if (name.includes('user') || name.includes('login') || name.includes('account') || 
           name.includes('signin') || name.includes('username') ||
           id.includes('user') || id.includes('login') || id.includes('account') || 
           id.includes('signin') || id.includes('username') ||
           placeholder.includes('user') || placeholder.includes('login') || 
           placeholder.includes('account') || placeholder.includes('signin') ||
           className.includes('user') || className.includes('login') || 
           className.includes('account') || className.includes('signin') ||
           ariaLabel.includes('user') || ariaLabel.includes('login') || 
           ariaLabel.includes('account') || ariaLabel.includes('signin')) {
    fieldType = 'username';
  }
  // Submit button detection
  else if (type === 'submit') {
    fieldType = 'submit';
  }
  // For text inputs, be more inclusive - check if it might be a login field
  else if (type === 'text' && (
    // If it's in a form with a password field, it's likely a username field
    document.querySelector('input[type="password"]') ||
    // If it has login-related context
    name.includes('name') || id.includes('name') ||
    placeholder.includes('name') || placeholder.includes('enter') ||
    // Common login field patterns
    name === 'login' || id === 'login' || name === 'user' || id === 'user'
  )) {
    fieldType = 'username';
  }
  
  // Don't filter out fields as aggressively - include more borderline cases
  if (fieldType === 'other' && type === 'text') {
    // If there's a password field on the page, include text fields that might be username
    const hasPasswordField = document.querySelector('input[type="password"]');
    if (hasPasswordField && (name || id || placeholder)) {
      fieldType = 'username'; // Assume it's a username field
    }
  }
  
  if (fieldType === 'other') {
    return null; // Only filter out if truly unrelated
  }
  
  const selector = id ? `#${id}` : name ? `input[name="${name}"]` : `input[type="${type}"]`;
  
  return {
    type: fieldType,
    selector,
    placeholder: input.placeholder || undefined,
    label: input.placeholder || input.labels?.[0]?.textContent || ariaLabel || 
           (fieldType.charAt(0).toUpperCase() + fieldType.slice(1)),
    required: input.required || false
  };
}

function analyzeButtonElement(button) {
  const type = button.type?.toLowerCase() || 'button';
  const text = button.textContent?.trim().toLowerCase() || '';
  const className = button.className?.toLowerCase() || '';
  
  if (type === 'submit' || 
      text.includes('login') || text.includes('sign in') || text.includes('log in') ||
      text.includes('submit') || text.includes('enter') || text.includes('go') ||
      className.includes('login') || className.includes('submit') ||
      className.includes('signin') || className.includes('btn-primary')) {
    return {
      type: 'submit',
      selector: button.id ? `#${button.id}` : 'button[type="submit"]',
      label: button.textContent?.trim() || 'Submit',
      required: false
    };
  }
  
  return null;
}

function parseInputField(inputTag) {
  const typeMatch = inputTag.match(/type=['"]([^'"]*)['"]/i);
  const nameMatch = inputTag.match(/name=['"]([^'"]*)['"]/i);
  const idMatch = inputTag.match(/id=['"]([^'"]*)['"]/i);
  const placeholderMatch = inputTag.match(/placeholder=['"]([^'"]*)['"]/i);
  const classMatch = inputTag.match(/class=['"]([^'"]*)['"]/i);
  const ariaLabelMatch = inputTag.match(/aria-label=['"]([^'"]*)['"]/i);
  const requiredMatch = inputTag.match(/required/i);
  
  const type = typeMatch?.[1]?.toLowerCase() || 'text';
  const name = nameMatch?.[1]?.toLowerCase() || '';
  const id = idMatch?.[1]?.toLowerCase() || '';
  const placeholder = placeholderMatch?.[1]?.toLowerCase() || '';
  const className = classMatch?.[1]?.toLowerCase() || '';
  const ariaLabel = ariaLabelMatch?.[1]?.toLowerCase() || '';
  
  let fieldType = 'other';
  
  // Enhanced detection patterns
  if (type === 'password') {
    fieldType = 'password';
  } else if (type === 'email' || 
             name.includes('email') || name.includes('mail') ||
             id.includes('email') || id.includes('mail') ||
             placeholder.includes('email') || placeholder.includes('mail') ||
             className.includes('email') || className.includes('mail') ||
             ariaLabel.includes('email') || ariaLabel.includes('mail')) {
    fieldType = 'email';
  } else if (name.includes('user') || name.includes('login') || name.includes('account') || 
             name.includes('signin') || name.includes('username') || name.includes('uname') ||
             id.includes('user') || id.includes('login') || id.includes('account') || 
             id.includes('signin') || id.includes('username') || id.includes('uname') ||
             placeholder.includes('user') || placeholder.includes('login') || 
             placeholder.includes('account') || placeholder.includes('signin') ||
             placeholder.includes('username') || placeholder.includes('name') ||
             className.includes('user') || className.includes('login') || 
             className.includes('account') || className.includes('signin') ||
             ariaLabel.includes('user') || ariaLabel.includes('login') || 
             ariaLabel.includes('account') || ariaLabel.includes('signin')) {
    fieldType = 'username';
  } else if (type === 'submit') {
    fieldType = 'submit';
  }
  // Be more inclusive with text fields
  else if (type === 'text' && (name || id || placeholder)) {
    // If it has any identifying attributes, treat as potential username field
    fieldType = 'username';
  }
  
  // Only filter out if it's truly not relevant
  if (fieldType === 'other' && !name && !id && !placeholder) {
    return null;
  }
  
  if (fieldType === 'other') {
    fieldType = 'username'; // Default to username for unclassified fields with attributes
  }
  
  const selector = id ? `#${id}` : name ? `input[name="${nameMatch?.[1]}"]` : `input[type="${type}"]`;
  
  return {
    type: fieldType,
    selector,
    placeholder: placeholderMatch?.[1] || undefined,
    label: placeholderMatch?.[1] || ariaLabelMatch?.[1] || 
           (fieldType.charAt(0).toUpperCase() + fieldType.slice(1)),
    required: !!requiredMatch
  };
}

function parseButtonField(buttonTag) {
  const typeMatch = buttonTag.match(/type=['"]([^'"]*)['"]/i);
  const textMatch = buttonTag.match(/>([^<]*)</);
  const classMatch = buttonTag.match(/class=['"]([^'"]*)['"]/i);
  
  const type = typeMatch?.[1]?.toLowerCase() || 'button';
  const text = textMatch?.[1]?.trim().toLowerCase() || '';
  const className = classMatch?.[1]?.toLowerCase() || '';
  
  if (type === 'submit' || 
      text.includes('login') || text.includes('sign in') || text.includes('log in') ||
      text.includes('submit') || text.includes('enter') || text.includes('go') ||
      text.includes('continue') || text.includes('next') ||
      className.includes('login') || className.includes('submit') ||
      className.includes('signin') || className.includes('btn-primary') ||
      className.includes('btn-login')) {
    return {
      type: 'submit',
      selector: 'button[type="submit"]',
      label: textMatch?.[1]?.trim() || 'Submit',
      required: false
    };
  }
  
  return null;
}

module.exports = {
  analyzeInputElement,
  analyzeButtonElement,
  parseInputField,
  parseButtonField
};
