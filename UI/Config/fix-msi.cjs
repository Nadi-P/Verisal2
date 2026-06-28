const fs = require('fs');
const { tenantId, blockUnauthorizedTenant } = require('./tenant-config.cjs');

// === Corporate tenant gate ===========================================
// Values come from tenant-config.cjs. When blockUnauthorizedTenant is true,
// the installer only proceeds on machines AzureAD-joined to tenantId.
const WITHAUTHORIZATIONCHECK = blockUnauthorizedTenant;
const TENANT_GUID = tenantId;
const BLOCK_MESSAGE =
  "ההתקנה נחסמה. מחשב לא מאומת.";
// =====================================================================

// electron-builder calls this with the project file path
exports.default = async function(projectFile) {
  let content = fs.readFileSync(projectFile, 'utf8');

  // Conditionally inject tenant gate if authorization check is enabled
  if (WITHAUTHORIZATIONCHECK) {
    const tenantKey = `SYSTEM\\CurrentControlSet\\Control\\CloudDomainJoin\\TenantInfo\\${TENANT_GUID}`;
    const tenantGate = [
      '    <Property Id="VERISALAADTENANT" Secure="yes">',
      `      <RegistrySearch Id="VerisalAadTenantSearch" Root="HKLM" Key="${tenantKey}" Name="DisplayName" Type="raw" Win64="yes"/>`,
      '    </Property>',
      `    <Condition Message="${BLOCK_MESSAGE}"><![CDATA[Installed OR VERISALAADTENANT]]></Condition>`,
      ''
    ].join('\n');

    // Insert after the <Product> opening and its immediate children
    content = content.replace(
      '<Property Id="DISABLEADVTSHORTCUTS" Value="1"/>',
      '<Property Id="DISABLEADVTSHORTCUTS" Value="1"/>\n' + tenantGate
    );
  }

  fs.writeFileSync(projectFile, content, 'utf8');
};
