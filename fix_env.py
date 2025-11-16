import re

# Read the .env.dev file
with open('.env.dev', 'r') as f:
    content = f.read()

# Extract the Firebase private key section
pattern = r'FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----.*?-----END PRIVATE KEY-----'
match = re.search(pattern, content, re.DOTALL)

if match:
    # Get the multi-line key
    multiline_key = match.group(0)
    
    # Extract just the key content (between the markers)
    key_content = multiline_key.replace('FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n', '')
    key_content = key_content.replace('\n-----END PRIVATE KEY-----', '')
    
    # Remove all newlines from the key content
    key_content = key_content.replace('\n', '')
    
    # Create the properly formatted single-line version
    single_line_key = f'FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n{key_content}\\n-----END PRIVATE KEY-----"'
    
    # Replace in content
    content = content.replace(multiline_key, single_line_key)
    
    # Write back to file
    with open('.env.dev', 'w') as f:
        f.write(content)
    
    print("Fixed Firebase private key formatting")
else:
    print("No Firebase private key found")
