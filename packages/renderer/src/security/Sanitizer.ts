import DOMPurify from 'isomorphic-dompurify';
import { SecurityLevel } from '../types';

/**
 * Sanitizes content based on security level to prevent XSS attacks
 */
export const sanitizeContent = (content: string, level: SecurityLevel = 'safe'): string => {
  const config = {
    safe: {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'blockquote', 'hr', 'div', 'span', 'del', 'mark', 'sup', 'sub'
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel'],
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'],
      FORBID_ATTR: ['onclick', 'onload', 'onerror', 'javascript:']
    },
    trusted: {
      // More permissive for trusted content
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'blockquote', 'hr', 'div', 'span', 'del', 'mark', 'sup', 'sub',
        'iframe', 'video', 'audio', 'source'
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel',
        'width', 'height', 'frameborder', 'allowfullscreen'
      ],
      FORBID_TAGS: ['script'],
      FORBID_ATTR: ['onclick', 'onload', 'onerror', 'javascript:']
    },
    sandbox: {
      // Very restrictive for untrusted content
      ALLOWED_TAGS: ['div', 'span', 'p', 'strong', 'em', 'br'],
      ALLOWED_ATTR: ['class'],
      FORBID_TAGS: ['script', 'style', 'iframe', 'a', 'img', 'video', 'audio'],
      FORBID_ATTR: ['onclick', 'onload', 'onerror', 'javascript:', 'href', 'src']
    }
  };

  const sanitizeConfig = config[level];
  
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: sanitizeConfig.ALLOWED_TAGS,
    ALLOWED_ATTR: sanitizeConfig.ALLOWED_ATTR,
    FORBID_TAGS: sanitizeConfig.FORBID_TAGS,
    FORBID_ATTR: sanitizeConfig.FORBID_ATTR,
    // Additional security options
    WHOLE_DOCUMENT: false,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    SANITIZE_DOM: true,
    KEEP_CONTENT: false,
    IN_PLACE: false,
    ALLOW_ARIA_ATTR: true,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SAFE_FOR_TEMPLATES: true
  });
};

/**
 * Validates block payload size and structure to prevent DoS attacks
 */
export const validateBlockPayload = (payload: any, maxSize: number = 1024 * 1024): boolean => {
  try {
    const serialized = JSON.stringify(payload);
    const size = new Blob([serialized]).size;
    
    // Check size limit (default 1MB)
    if (size > maxSize) {
      console.warn(`Block payload too large: ${size} bytes (max: ${maxSize})`);
      return false;
    }
    
    // Check for potential security issues
    if (typeof payload === 'string') {
      // Check for script tags or javascript: protocols
      const dangerousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /data:text\/html/gi,
        /vbscript:/gi
      ];
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(payload)) {
          console.warn('Potentially dangerous content detected in payload');
          return false;
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('Failed to validate block payload:', error);
    return false;
  }
};

/**
 * Sanitizes URLs to prevent malicious redirects
 */
export const sanitizeUrl = (url: string): string => {
  try {
    const parsedUrl = new URL(url);
    
    // Only allow safe protocols
    const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      return '#';
    }
    
    return url;
  } catch {
    // Invalid URL
    return '#';
  }
};

/**
 * Escapes HTML entities in plain text
 */
export const escapeHtml = (text: string): string => {
  const entityMap: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;'
  };
  
  return String(text).replace(/[&<>"'\/]/g, (char) => entityMap[char]);
}; 