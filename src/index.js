import {
  Scene,
  WebGLRenderer,
  PerspectiveCamera,
  IcosahedronBufferGeometry,
  ParametricBufferGeometry,
  MeshPhysicalMaterial,
  Mesh,
  AmbientLight,
  DirectionalLight,
  Color,
  Vector3,
  Clock
} from 'three'

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

import Tweakpane from 'tweakpane'

class App {
  constructor(container) {
    this.container = document.querySelector(container)

    this._resizeCb = () => this._onResize()
  }

  init() {
    this._createScene()
    this._createCamera()
    this._createRenderer()
    this._createHelicoid()
    this._createSpheres()
    this._createLight()
    this._createClock()
    this._addListeners()
    this._createControls()
    this._createDebugPanel()

    this.renderer.setAnimationLoop(() => {
      this._update()
      this._render()
    })

    console.log(this)
  }

  destroy() {
    this.renderer.dispose()
    this._removeListeners()
  }

  _update() {
    const t = this.clock.getElapsedTime()
    this.helicoid.rotation.y = t

    if (!!this.helicoid.material.userData.shader) {
      this.helicoid.material.userData.shader.uniforms.playhead.value = t*0.5
      this.ball1.material.userData.shader.uniforms.playhead.value = t*0.5
      this.ball2.material.userData.shader.uniforms.playhead.value = t*0.5
    }

    const theta1 = t * 0.32 * Math.PI
    const theta2 = t * 0.32 * Math.PI + Math.PI

    this.ball1.position.x = 0.6 * Math.sin(theta1)
    this.ball1.position.z = 0.6 * Math.cos(theta1)

    this.ball2.position.x = 0.6 * Math.sin(theta2)
    this.ball2.position.z = 0.6 * Math.cos(theta2)
  }

  _render() {
    this.renderer.render(this.scene, this.camera)
  }

  _createScene() {
    this.scene = new Scene()
  }

  _createCamera() {
    this.camera = new PerspectiveCamera(75, this.container.clientWidth / this.container.clientHeight, 0.1, 100)
    this.camera.position.set(0, 0, 3)
  }

  _createRenderer() {
    this.renderer = new WebGLRenderer({
      alpha: true,
      antialias: true
    })

    this.container.appendChild(this.renderer.domElement)

    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight)
    this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio))
    this.renderer.setClearColor(0x121212)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = 2 // THREE.PCFSoftShadowMap
    this.renderer.physicallyCorrectLights = true
  }

  _createLight() {
    this.ambientLight = new AmbientLight(0xffffff, 4)
    this.scene.add(this.ambientLight)

    this.directionalLight = new DirectionalLight(0xffffff, 1)
    this.directionalLight.position.set(0, 1, 1)
    this.directionalLight.castShadow = true
    this.directionalLight.shadow.mapSize.width = 2048
    this.directionalLight.shadow.mapSize.height = 2048

    this.directionalLight.shadow.camera.right = 2
    this.directionalLight.shadow.camera.left = -2
    this.directionalLight.shadow.camera.bottom = -2
    this.directionalLight.shadow.camera.top = 2

    // this.directionalLight.shadow.bias = 0.00001

    this.scene.add(this.directionalLight)
  }

  _getMaterial() {
    const material = new MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.5,
      roughness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.4,
      wireframe: false,
      side: 2 // THREE.DoubleSide
    })

    material.onBeforeCompile = shader => {
      shader.uniforms.playhead = { value: 0 }

      shader.fragmentShader = `
        uniform float playhead;
      ` + shader.fragmentShader

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <logdepthbuf_fragment>',
        `
          vec3 colorA = vec3(0.5, 0.5, 0.5);
          vec3 colorB = vec3(0.5, 0.5, 0.5);
          vec3 colorC = vec3(2.0, 1.0, 0.);
          vec3 colorD = vec3(0.5, 0.2, 0.25);

          float diff = dot(vec3(1.0), vNormal);
          vec3 color = colorA + colorB * cos(2. * 3.141592 * (colorC * diff + colorD + playhead));

          diffuseColor.rgb = color;
        ` + '#include <logdepthbuf_fragment>'
      )

      material.userData.shader = shader
    }

    return material
  }

  _createHelicoid() {
    const material = this._getMaterial()

    const helicoidVector = new Vector3()
    function Helicoid(u, v, helicoidVector) {
      const alpha = Math.PI*2*(u - 0.5)
      const theta = Math.PI*2*(v - 0.5)
      const dividend = 1 + Math.cosh(alpha) * Math.cosh(theta)
      const t = 1.5

      const x = Math.sinh(theta) * Math.cos(t * alpha) / dividend
      const z = Math.sinh(theta) * Math.sin(t * alpha) / dividend
      const y = 1.5  * Math.cosh(theta) * Math.sinh(alpha) / dividend

      helicoidVector.set(x, y, z)
    }
    const geometry = new ParametricBufferGeometry(Helicoid, 100, 100)

    this.helicoid = new Mesh(geometry, material)

    this.helicoid.castShadow = this.helicoid.receiveShadow = true

    this.scene.add(this.helicoid)
  }

  _createSpheres() {
    const geom = new IcosahedronBufferGeometry(0.23, 5)

    this.ball1 = new Mesh(geom, this._getMaterial())
    this.ball2 = new Mesh(geom, this._getMaterial())

    this.ball1.castShadow = this.ball1.receiveShadow = true
    this.ball2.castShadow = this.ball2.receiveShadow = true

    this.scene.add(this.ball1)
    this.scene.add(this.ball2)
  }

  _createControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
  }

  _createDebugPanel() {
    this.pane = new Tweakpane()

    /**
     * Scene configuration
     */
    const sceneFolder = this.pane.addFolder({ title: 'Scene' })

    let params = { background: { r: 18, g: 18, b: 18 } }

    sceneFolder.addInput(params, 'background', { label: 'Background Color' }).on('change', value => {
      this.renderer.setClearColor(new Color(`rgb(${parseInt(value.r)}, ${parseInt(value.g)}, ${parseInt(value.b)})`))
    })

    /**
     * Ambient Light configuration
     */
    const ambientLightFolder = this.pane.addFolder({ title: 'Ambient Light' })

    params = {
      color: { r: 255, g: 255, b: 255 },
      intensity: 4
    }

    ambientLightFolder.addInput(params, 'color', { label: 'Color' }).on('change', value => {
      this.ambientLight.color = new Color(`rgb(${parseInt(value.r)}, ${parseInt(value.g)}, ${parseInt(value.b)})`)
    })

    ambientLightFolder.addInput(params, 'intensity', { label: 'Intensity', min: 0, max: 10 }).on('change', value => {
      this.ambientLight.intensity = value
    })

    /**
     * Directional Light configuration
     */
    const directionalLightFolder = this.pane.addFolder({ title: 'Directional Light' })

    params = {
      color: { r: 255, g: 255, b: 255 },
      intensity: 1
    }

    directionalLightFolder.addInput(params, 'color', { label: 'Color' }).on('change', value => {
      this.directionalLight.color = new Color(`rgb(${parseInt(value.r)}, ${parseInt(value.g)}, ${parseInt(value.b)})`)
    })

    directionalLightFolder.addInput(params, 'intensity', { label: 'Intensity', min: 0, max: 10 }).on('change', value => {
      this.directionalLight.intensity = value
    })
  }

  _createClock() {
    this.clock = new Clock()
  }

  _addListeners() {
    window.addEventListener('resize', this._resizeCb, { passive: true })
  }

  _removeListeners() {
    window.removeEventListener('resize', this._resizeCb, { passive: true })
  }

  _onResize() {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight)
  }
}

const app = new App('#app')
app.init()
