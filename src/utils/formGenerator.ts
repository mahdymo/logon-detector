
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
      
      const response = await fetch('https://mbjldjsdkxibnmkxswjh.supabase.co/functions/v1/save-form', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iamxkanNka3hpYm5ta3hzd2poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2ODIzNzYsImV4cCI6MjA2NTI1ODM3Nn0.TSPkKdMgD79grpkzQ6mnJP3fozp2MX5spJQ_VvrCb-E`
        },
        body: JSON.stringify({
          target_url: targetUrl,
          fields,
          html_code: htmlCode,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save form');
      }

      const result = await response.json();
      return result.id;
      
    } catch (error) {
      console.error('Error saving form:', error);
      throw error;
    }
  }

  static async loadGeneratedForms(): Promise<GeneratedForm[]> {
    try {
      const response = await fetch('https://mbjldjsdkxibnmkxswjh.supabase.co/functions/v1/forms', {
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iamxkanNka3hpYm5ta3hzd2poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2ODIzNzYsImV4cCI6MjA2NTI1ODM3Nn0.TSPkKdMgD79grpkzQ6mnJP3fozp2MX5spJQ_VvrCb-E`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load forms');
      }

      return await response.json();
      
    } catch (error) {
      console.error('Error loading forms:', error);
      return [];
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
