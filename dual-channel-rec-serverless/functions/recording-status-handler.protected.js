exports.handler = function(context, event, callback) {
  const {
    CallSid,
    RecordingSid,
    RecordingStatus,
    RecordingUrl
  } = event;

  console.log(`Recording for ${CallSid} ${RecordingStatus}`)

  if (RecordingStatus === 'completed') {
    console.log(`Recording ${RecordingSid} is available at ${RecordingUrl}`);
  }

  callback(null, {});
}