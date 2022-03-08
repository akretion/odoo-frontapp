// app.js cannot be loaded as a module because it would be
// either minified or either exploded in gazillon files Odoo 14 won't serve => impossible to debug!
// And if app.js is not an ES6 module, then it cannot load any ES6 module (FrontApp)...
// So this trivial ES6 module is here to required the FrontApp module
// and make Front available in window.Front for later use from non ES6 app.js...
// Where is my full stack developper award?
import Front from "@frontapp/plugin-sdk";
window.Front = Front;
