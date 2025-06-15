
interface DetectedField {
  type: 'username' | 'email' | 'password' | 'submit' | 'other';
  selector: string;
  placeholder?: string;
  label?: string;
  required: boolean;
}

interface GeneratedForm {
  id: string;
  target_url: string;
  fields: DetectedField[];
  html_code: string;
  created_at: string;
}

export class FormGenerator {
  static async saveGeneratedForm(targetUrl: string, fields: DetectedField[]): Promise<string> {
    try {
      const htmlCode = this.generateFormHTML(targetUrl, fields);
      
      const response = await fetch('http://localhost:3000/api/forms/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target_url: targetUrl,
          fields,
          html_code: htmlCode,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save form: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      return result.id;
      
    } catch (error) {
      console.error('Error saving form:', error);
      throw new Error(`Failed to save form: ${error instanceof Error ? error.message : 'Unknown error'}. Make sure Docker services are running.`);
    }
  }

  static async loadGeneratedForms(): Promise<GeneratedForm[]> {
    try {
      const response = await fetch('http://localhost:3000/api/forms/list');
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to load forms: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json();
      
    } catch (error) {
      console.error('Error loading forms:', error);
      throw new Error(`Failed to load forms: ${error instanceof Error ? error.message : 'Unknown error'}. Make sure Docker services are running.`);
    }
  }

  static generateFormHTML(targetUrl: string, fields: DetectedField[]): string {
    const loginFields = fields.filter(f => f.type !== 'submit');
    
    return `<form method="POST" action="${targetUrl}">
${loginFields.map(field => `  <div>
    <label for="${field.type}">${field.label || field.type.charAt(0).toUpperCase() + field.type.slice(1)}</label>
    <input 
      type="${field.type === 'password' ? 'password' : 'text'}" 
      name="${field.type}"
      id="${field.type}"
      ${field.placeholder ? `placeholder="${field.placeholder}"` : ''}
      ${field.required ? 'required' : ''}
    />
  </div>`).join('\n')}
  <button type="submit">Login</button>
</form>`;
  }
}
