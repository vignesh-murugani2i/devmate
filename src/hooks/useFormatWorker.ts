import { useCallback } from 'react';

export const useFormatWorker = () => {
  const formatText = useCallback(async (text: string, formatType: string): Promise<string> => {
    // Implement formatting directly instead of using web worker
    try {
      switch (formatType) {
        case 'json':
          const parsedJson = JSON.parse(text);
          return JSON.stringify(parsedJson, null, 2);
          
        case 'xml':
          return formatXML(text);
          
        case 'jwt':
          return parseJWT(text);
          
        case 'json-summary':
          return generateJSONSummary(text);
          
        case 'encode':
          return btoa(unescape(encodeURIComponent(text)));
          
        case 'decode':
          return decodeURIComponent(escape(atob(text)));
          
        default:
          throw new Error(`Unknown format type: ${formatType}`);
      }
    } catch (error) {
      throw new Error(`Formatting error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  const cleanup = useCallback(() => {
    // No cleanup needed
  }, []);

  return { formatText, cleanup };
};

// Helper function to format XML
function formatXML(xml: string): string {
  try {
    // Remove extra whitespace and normalize
    let formatted = xml.trim().replace(/>\s*</g, '><');
    
    // Add newlines between tags
    formatted = formatted.replace(/></g, '>\n<');
    
    // Add proper indentation
    const lines = formatted.split('\n');
    let indentLevel = 0;
    const indentChar = '  ';
    
    return lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      
      // Decrease indent for closing tags
      if (trimmed.startsWith('</')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }
      
      const indentedLine = indentChar.repeat(indentLevel) + trimmed;
      
      // Increase indent for opening tags (but not self-closing or closing tags)
      if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.endsWith('/>') && !trimmed.includes('</')) {
        indentLevel++;
      }
      
      return indentedLine;
    }).join('\n');
  } catch (error) {
    throw new Error(`XML formatting failed: ${error instanceof Error ? error.message : 'Invalid XML'}`);
  }
}

// Helper function to parse JWT
function parseJWT(token: string): string {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format - must have 3 parts separated by dots');
    }
    
    // Decode base64url
    const decodeBase64Url = (str: string) => {
      str = str.replace(/-/g, '+').replace(/_/g, '/');
      while (str.length % 4) {
        str += '=';
      }
      return atob(str);
    };
    
    const header = JSON.parse(decodeBase64Url(parts[0]));
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    
    return JSON.stringify({
      header,
      payload,
      signature: parts[2]
    }, null, 2);
  } catch (error) {
    throw new Error(`JWT parsing failed: ${error instanceof Error ? error.message : 'Invalid JWT token'}`);
  }
}

// Helper function to generate JSON summary
function generateJSONSummary(jsonText: string): string {
  try {
    const data = JSON.parse(jsonText);
    
    function analyzeValue(value: any, path: string = 'root'): any {
      if (value === null) return { type: 'null', path };
      if (Array.isArray(value)) {
        return {
          type: 'array',
          path,
          length: value.length,
          items: value.length > 0 ? analyzeValue(value[0], `${path}[0]`) : null
        };
      }
      if (typeof value === 'object') {
        const keys = Object.keys(value);
        return {
          type: 'object',
          path,
          keys: keys.length,
          properties: keys.slice(0, 10).map(key => ({
            key,
            ...analyzeValue(value[key], `${path}.${key}`)
          }))
        };
      }
      return { 
        type: typeof value, 
        path, 
        example: typeof value === 'string' ? `"${String(value).slice(0, 50)}${String(value).length > 50 ? '...' : ''}"` : String(value)
      };
    }
    
    const analysis = analyzeValue(data);
    
    function countTypes(obj: any): { [key: string]: number } {
      const counts: { [key: string]: number } = {};
      
      function traverse(value: any) {
        if (value === null) {
          counts.null = (counts.null || 0) + 1;
        } else if (Array.isArray(value)) {
          counts.array = (counts.array || 0) + 1;
          value.forEach(traverse);
        } else if (typeof value === 'object') {
          counts.object = (counts.object || 0) + 1;
          Object.values(value).forEach(traverse);
        } else {
          const type = typeof value;
          counts[type] = (counts[type] || 0) + 1;
        }
      }
      
      traverse(obj);
      return counts;
    }
    
    const typeCounts = countTypes(data);
    
    return JSON.stringify({
      summary: 'JSON Structure Analysis',
      rootType: analysis.type,
      statistics: {
        totalElements: Object.values(typeCounts).reduce((a, b) => a + b, 0),
        typeDistribution: typeCounts
      },
      structure: analysis
    }, null, 2);
  } catch (error) {
    throw new Error(`JSON summary failed: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
  }
}