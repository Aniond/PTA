// PTA3 Roll Handler
function handleResult(roll, record, msg) {
  var total = roll.total;
  var moveName = msg && msg.roll && msg.roll.metadata && msg.roll.metadata.moveName;
  var resultText = "";

  if (moveName) {
    resultText = "## " + moveName + "\n";
  }
  resultText += "**Roll Result:** " + total;

  api.sendMessage(resultText, undefined, [], []);
}
