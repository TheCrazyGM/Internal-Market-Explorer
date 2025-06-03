const options = {
  moduleCache: {
    vue: Vue,
  },
  async getFile(url) {
    const res = await fetch(url);
    if (!res.ok)
      throw Object.assign(new Error(res.statusText + " " + url), { res });
    return {
      getContentData: (asBinary) => (asBinary ? res.arrayBuffer() : res.text()),
    };
  },
  addStyle(textContent) {
    const style = Object.assign(document.createElement("style"), {
      textContent,
    });
    const ref = document.head.getElementsByTagName("style")[0] || null;
    document.head.insertBefore(style, ref);
  },
};

const { loadModule } = window["vue3-sfc-loader"];

const C = [
"hife-main"
];

var components = {};

for (let c of C)
  components[c] = Vue.defineAsyncComponent(() =>
    loadModule(`components/${c}.vue`, options),
  );

const app = Vue.createApp({
  components,
  template: `<${C[0]}></${C[0]}>`,
});
for (var i = 1; i < C.length; i++) {
  app.component(C[i], components[C[i]]);
}

app.mount("#app");
