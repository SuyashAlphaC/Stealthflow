🎬 StealthFlow Demo Guide
This script is designed for your demo video recording. It demonstrates the full Private Transfer -> Encrypted Announcement -> Privacy Scan -> Claim lifecycle.

🛠️ Setup (Before Recording)
Wallet: Ensure your ArgentX/Braavos wallet is connected to Sepolia Testnet and has distinct balances (e.g., > 1 STRK).
Clean State:
Clear Browser Console (F12).
Refresh the Page.
Bob's Keys (Recipient):
We will use these keys for the "Recipient" role so you can Copy/Paste them during the demo.
View Private Key: 0x1111111111111111111111111111111111111111111111111111111111111111
Spend Private Key: 0x2222222222222222222222222222222222222222222222222222222222222222
Meta-Address (to send to): (This is derived from above keys) starknet:0x04e183ec903cb6957864293e50cc3d3284db65a953a660d2b451fc77c73db29a-0x027781604a5006263df6307335df501980315ac233b664fe0901e16447c207d5
🎥 Scene 1: The Private Send (Alice)
Narrative: "First, I am Alice. I want to send funds to Bob privately without linking our wallets on-chain."

Navigate to "Send Privately".
Paste Recipient Meta-Address:
Use the address from Setup above.
Enter Amount: 0.001 STRK (or any small amount).
Click "Send Privately".
Sign Transaction: Approve in your wallet.
Wait for "Transaction Successful" toast.
Highlight: "The metadata (amount) is encrypted. The destination is a fresh stealth address."
🎥 Scene 2: The Discovery (Bob)
Narrative: "Now, I switch roles to Bob. I'm scanning the blockchain for payments that only I can see."

Navigate to "Privacy Scanner".
Enter Keys:
View Key: 0x1111111111111111111111111111111111111111111111111111111111111111
Spend Key: 0x2222222222222222222222222222222222222222222222222222222222222222
Click "Start Scanning".
Observe:
The scanner finds the transaction.
Crucial Moment: It displays "0.0010 STRK".
Say: "The scanner successfully decrypted the metadata. It fell back to on-chain checks if needed, but here we see the exact amount."
🎥 Scene 3: The Claim & Verification
Narrative: "Finally, I verify ownership and prepare to claim."

Click "Claim" on the discovered row.
Simulation UI:
Watch the steps (Signature, Deploy, Paymaster).
Open Console (F12) (Optional but recommended for "Tech Demo"):
Show the Cyan Logs:
[Claim] Computed Stealth Account Address: 0x...
[Claim] ✅ Account funded
Final Verification:
Copy the Stealth Account Address from the log.
Open Starkscan (Sepolia) and paste the address.
Show that the 0.001 STRK is sitting there.
Closing:
"The funds are secured at a deterministic address, ready to be swept using our CLI tools or Relayer network."
🚀 Key Technical Talking Points
Metadata Encryption: Amounts are XOR-encrypted with a shared secret (ECDH). Observers see random bytes; only Bob sees "0.001".
Deterministic Addresses: We use UDC (Universal Deployer Contract) deployment, ensuring the stealth address is mathematically predictable and claimable.
Gasless Architecture: The system supports Paymaster verification (simulated in UI, ready in contracts) to allow withdrawing funds without having ETH for gas.