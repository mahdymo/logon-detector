
const { parseInputField, parseButtonField } = require('./fieldDetector');

function analyzeHtmlForLoginFields(html) {
  const fields = [];
  console.log('Starting HTML-based field analysis...');
  
  // Enhanced regex patterns for modern HTML
  const inputRegex = /<input[^>]*>/gi;
  const buttonRegex = /<button[^>]*>.*?<\/button>/gi;
  
  let match;
  let inputCount = 0;
  
  // Analyze input fields
  while ((match = inputRegex.exec(html)) !== null) {
    inputCount++;
    const inputTag = match[0];
    console.log(`Analyzing HTML input ${inputCount}:`, inputTag.substring(0, 100));
    
    const field = parseInputField(inputTag);
    if (field) {
      console.log(`HTML input ${inputCount} classified as:`, field.type);
      fields.push(field);
    } else {
      console.log(`HTML input ${inputCount} filtered out`);
    }
  }
  
  let buttonCount = 0;
  // Analyze buttons
  while ((match = buttonRegex.exec(html)) !== null) {
    buttonCount++;
    const buttonTag = match[0];
    console.log(`Analyzing HTML button ${buttonCount}:`, buttonTag.substring(0, 100));
    
    const field = parseButtonField(buttonTag);
    if (field) {
      console.log(`HTML button ${buttonCount} classified as:`, field.type);
      fields.push(field);
    }
  }
  
  console.log(`HTML analysis complete: ${fields.length} fields detected from ${inputCount} inputs and ${buttonCount} buttons`);
  
  // Fallback: if no fields detected but there's a password field, be more inclusive
  if (fields.length === 0 && html.includes('type="password"')) {
    console.log('No fields detected but password field exists, applying fallback detection...');
    const fallbackFields = applyFallbackDetection(html);
    fields.push(...fallbackFields);
  }
  
  return fields;
}

function applyFallbackDetection(html) {
  console.log('Applying fallback detection for missed login fields...');
  const fields = [];
  
  // Find all input tags and be very inclusive
  const inputRegex = /<input[^>]*>/gi;
  let match;
  
  while ((match = inputRegex.exec(html)) !== null) {
    const inputTag = match[0];
    const typeMatch = inputTag.match(/type=['"]([^'"]*)['"]/i);
    const nameMatch = inputTag.match(/name=['"]([^'"]*)['"]/i);
    const idMatch = inputTag.match(/id=['"]([^'"]*)['"]/i);
    
    const type = typeMatch?.[1]?.toLowerCase() || 'text';
    const name = nameMatch?.[1] || '';
    const id = idMatch?.[1] || '';
    
    if (type === 'password') {
      fields.push({
        type: 'password',
        selector: id ? `#${id}` : name ? `input[name="${name}"]` : 'input[type="password"]',
        label: 'Password',
        required: inputTag.includes('required')
      });
    } else if (type === 'text' || type === 'email') {
      // In fallback mode, include any text/email field
      fields.push({
        type: type === 'email' ? 'email' : 'username',
        selector: id ? `#${id}` : name ? `input[name="${nameMatch?.[1]}"]` : `input[type="${type}"]`,
        label: type === 'email' ? 'Email' : 'Username',
        required: inputTag.includes('required')
      });
    }
  }
  
  console.log(`Fallback detection found ${fields.length} fields`);
  return fields;
}

function extractTitle(html) {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return titleMatch?.[1]?.trim() || 'Unknown';
}

module.exports = {
  analyzeHtmlForLoginFields,
  applyFallbackDetection,
  extractTitle
};
