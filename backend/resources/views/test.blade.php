
<script src="{{asset('/js/achramp-risk-sdk.min.js')}}"></script>
<script>
    ACHRampRiskSDK.getChannelCookie()
  .then((channelCookie) => {
    console.log("channelCookie:", channelCookie);
  })
  .catch((error) => {
    console.error("Failed to get channelCookie:", error);
  });

  ACHRampRiskSDK.getCookie()
  .then((cookie) => {
    console.log("Cookie:", cookie);
  })
  .catch((error) => {
    console.error("Failed to get Cookie:", error);
  });
</script>
