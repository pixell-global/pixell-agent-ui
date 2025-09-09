#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Transform experimental Next.js build output for AWS Amplify compatibility
 */
async function transformBuildForAmplify() {
  console.log('🔄 Transforming experimental build output for AWS Amplify...');
  
  const buildDir = path.join(process.cwd(), '.next');
  const manifestPath = path.join(buildDir, 'deploy-manifest.json');
  
  // Read existing manifest files for route information
  const appPathRoutes = JSON.parse(fs.readFileSync(path.join(buildDir, 'app-path-routes-manifest.json'), 'utf8'));
  const routesManifest = JSON.parse(fs.readFileSync(path.join(buildDir, 'routes-manifest.json'), 'utf8'));
  const buildId = fs.readFileSync(path.join(buildDir, 'BUILD_ID'), 'utf8').trim();
  
  // Generate deploy-manifest.json for AWS Amplify WEB_COMPUTE platform
  const deployManifest = {
    version: 1,
    framework: {
      name: 'Next.js',
      version: '^15.0.0'
    },
    imageSettings: {
      sizes: [16, 32, 48, 64, 96, 128, 256, 384],
      formats: ['image/webp', 'image/jpeg'],
      remotePatterns: [],
      dangerouslyAllowSVG: false,
      contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;"
    },
    routes: [],
    computeResources: [
      {
        name: 'default',
        runtime: 'nodejs20.x',
        entrypoint: 'server.js'
      }
    ]
  };
  
  // Generate routes from app-path-routes-manifest
  for (const [routeKey, routePath] of Object.entries(appPathRoutes)) {
    if (routeKey.endsWith('/route')) {
      // API route
      deployManifest.routes.push({
        path: routePath,
        target: {
          kind: 'Compute',
          src: 'default'
        },
        headers: {
          'cache-control': 'public, max-age=0, must-revalidate'
        }
      });
    } else if (routeKey.endsWith('/page')) {
      // Page route
      deployManifest.routes.push({
        path: routePath,
        target: {
          kind: 'Compute', 
          src: 'default'
        },
        headers: {
          'cache-control': 'public, max-age=0, must-revalidate'
        }
      });
    }
  }
  
  // Add static asset routes
  deployManifest.routes.push({
    path: '/_next/static/*',
    target: {
      kind: 'Static'
    },
    headers: {
      'cache-control': 'public, max-age=31536000, immutable'
    }
  });
  
  // Add favicon route
  deployManifest.routes.push({
    path: '/favicon.ico',
    target: {
      kind: 'Static'
    }
  });
  
  // Add catch-all route
  deployManifest.routes.push({
    path: '/*',
    target: {
      kind: 'Compute',
      src: 'default'
    },
    headers: {
      'cache-control': 'public, max-age=0, must-revalidate'
    }
  });
  
  // Write deploy-manifest.json
  fs.writeFileSync(manifestPath, JSON.stringify(deployManifest, null, 2));
  console.log('✅ Generated deploy-manifest.json');
  
  // Create server.js entry point for compute
  const serverJsPath = path.join(buildDir, 'server.js');
  const serverJs = `
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = process.env.PORT || 3000;

const app = next({ 
  dev, 
  hostname, 
  port,
  conf: {
    experimental: {
      outputStandalone: true
    }
  }
});
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  })
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(\`> Ready on http://\${hostname}:\${port}\`);
    });
});
`.trim();
  
  fs.writeFileSync(serverJsPath, serverJs);
  console.log('✅ Generated server.js entry point');
  
  // Create compute directory structure if needed
  const computeDir = path.join(buildDir, 'compute');
  if (!fs.existsSync(computeDir)) {
    fs.mkdirSync(computeDir, { recursive: true });
  }
  
  // Copy necessary files for compute environment
  const packageJson = {
    name: 'amplify-nextjs-compute',
    version: '1.0.0',
    main: 'server.js',
    scripts: {
      start: 'node server.js'
    },
    dependencies: {
      next: '^15.5.2',
      react: '^19.1.0',
      'react-dom': '^19.1.0'
    }
  };
  
  fs.writeFileSync(path.join(buildDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  console.log('✅ Updated package.json for compute environment');
  
  console.log('🎉 Build transformation complete! Ready for AWS Amplify deployment.');
}

// Run transformation
transformBuildForAmplify().catch(console.error);