const fs = require('fs');
const path = require('path');

// electron-builder calls this with the project file path
exports.default = async function(projectFile) {
  let content = fs.readFileSync(projectFile, 'utf8');

  // Find the appDir to reference the exe for the icon
  const appDirMatch = content.match(/\$\(var\.appDir\)/);
  if (!appDirMatch) return;

  // Add the <Icon> element that WiX needs for advertised shortcuts
  // It must appear inside <Product> before the shortcuts reference it
  const iconElement = '    <Icon Id="VerisalPAQAIcon.exe" SourceFile="$(var.appDir)\\Verisal PAQA.exe"/>\n';

  // Insert after the <Product> opening and its immediate children
  content = content.replace(
    '<Property Id="DISABLEADVTSHORTCUTS" Value="1"/>',
    '<Property Id="DISABLEADVTSHORTCUTS" Value="1"/>\n' + iconElement
  );

  fs.writeFileSync(projectFile, content, 'utf8');
};
