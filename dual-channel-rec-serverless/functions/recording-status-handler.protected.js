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

  console.log('Event properties:');
  Object.keys(event).forEach(key => {
    console.log(`${key}: ${event[key]}`);
  });

  callback(null, {});
}