'use strict';
// Keep the static server in the audit process so sandboxed browser requests
// use the same network namespace. CI can also use its normal HTTP server.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const audit=process.argv[2];if(!audit||!/^audit_[\w]+\.js$/.test(audit))throw Error('Pass an audit_*.js filename');
const root=path.resolve('docs');
const server=http.createServer((req,res)=>{
 const filename=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!filename.startsWith(root+path.sep)){res.statusCode=403;res.end();return}
 try{res.setHeader('Content-Type',({'.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'})[path.extname(filename)]||'text/html');res.end(fs.readFileSync(filename))}catch{res.statusCode=404;res.end()}
});
server.listen(0,'127.0.0.1',()=>{process.env.SITE_TEST_URL=`http://127.0.0.1:${server.address().port}/`;server.unref();require('node:module').runMain(path.resolve('scripts',audit))});
