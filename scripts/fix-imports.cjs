const fs = require('fs');

const files = [
  'src/security/components/blockchain/BlockchainBadges.tsx',
  'src/security/components/blockchain/BlockchainMetaPanel.tsx',
  'src/security/components/blockchain/useBlockchainState.ts',
  'src/security/components/blockchain/BlockchainDashboardPage.tsx',
  'src/security/components/blockchain/BlockchainVerifyPage.tsx',
  'src/security/components/blockchain/BlockchainQrPage.tsx',
  'src/security/components/blockchain/BlockchainQrView.tsx',
  'src/security/components/blockchain/BlockchainAuditExplorerPage.tsx',
];

for (const f of files) {
  let c = fs.readFileSync(f, 'utf8');
  // Fix '../../blockchain' -> '../../../blockchain'
  c = c.replace(/'\.\.\/\.\.\/blockchain'/g, "'../../../blockchain'");
  // Fix '../../lib/firebaseDb' -> '../../lib/firebaseDb' (this is correct already for components at 3 levels)
  // Fix '../types' -> '../../../blockchain/types' for badges/meta
  c = c.replace(/'\.\.\/types'/g, "'../../../blockchain/types'");
  // Fix '../../lib/firebaseDb' stays as is
  fs.writeFileSync(f, c);
  console.log('fixed', f);
}
console.log('done');
