let model;
self.onmessage = async ({data}) => {
  try {
    if (data.open) {
      const {loadHandModel} = await import(`./hand-detector.js${self.location.search}`);
      model = await loadHandModel(new OffscreenCanvas(1,1));
      self.postMessage({ready:true});
    } else {
      const {landmarks,worldLandmarks,handedness} = model.detectForVideo(data.image,data.time);
      self.postMessage({landmarks,worldLandmarks,handedness});
    }
  } catch (error) { self.postMessage({error:error.message || 'Hand tracking failed.'}); }
  finally { data.image?.close(); }
};
