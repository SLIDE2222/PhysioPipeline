EDIT PROFILE FIX

Replace these frontend files:
- api.js
- editar-perfil.html
- editar-perfil.js

What changed:
- Added window.physioApi.updateMyProfile()
- editar-perfil.html now cache-busts:
  api.js?v=editprofilefix1
  script.js?v=editprofilefix1
  editar-perfil.js?v=editprofilefix1

Then commit, push, redeploy frontend.
