// get_campaign_id.js
// Run: node get_campaign_id.js <inviteCode> <email> <password>
// Example: node get_campaign_id.js ABC123 david.laselle@gmail.com 1944dave

const [,, inviteCode, email, password] = process.argv;

if (!inviteCode || !email || !password) {
  console.log("Usage: node get_campaign_id.js <inviteCode> <email> <password>");
  process.exit(1);
}

async function main() {
  try {
    // Step 1: Login
    const loginRes = await fetch("https://utilities.realmvtt.com/authentication", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategy: "local", email, password })
    });

    const loginData = await loginRes.json();
    const token = loginData.accessToken;

    if (!token) {
      console.error("Login failed. Check your email and password.");
      console.error(loginData);
      process.exit(1);
    }

    console.log("Login successful!");

    // Step 2: Look up campaign by invite code
    const res = await fetch(
      "https://utilities.realmvtt.com/campaigns?inviteCode=" + encodeURIComponent(inviteCode),
      { headers: { Authorization: "Bearer " + token } }
    );

    const data = await res.json();

    if (!data.data || data.data.length === 0) {
      console.error("No campaign found for invite code: " + inviteCode);
      process.exit(1);
    }

    const campaign = data.data[0];
    console.log("Campaign Name: " + campaign.name);
    console.log("Campaign ID:   " + campaign._id);
    console.log("\nUse this ID in your import commands:");
    console.log("node ..\\src\\cli.js records pta3_pokemon.csv -c " + campaign._id + " -e " + email + " -p " + password);

  } catch (err) {
    console.error("Error:", err.message);
  }
}

main();
