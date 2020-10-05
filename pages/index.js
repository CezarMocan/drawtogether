import React from 'react'
import Style from '../static/styles/main.less'
import Head from '../components/Head'
import paper, { Point, Size } from 'paper'
import io from 'socket.io-client/dist/socket.io'
import classnames from 'classnames'

const randomColor = () => { return { hue: Math.random() * 360, saturation: 0.8, brightness: 0.8, alpha: 0.5 } }

const CANVAS_WIDTH = 1050
const CANVAS_HEIGHT = 600

const prompts = [
  {
    prompt: 'a happy sheep facing left.',
    time: 45
  },
  {
    prompt: 'three droopy plants.',
    time: 45
  },
  {
    prompt: 'a straight line, across the canvas.',
    time: 15
  },
  {
    prompt: 'a large monster going to work.',
    time: 45
  },
  {
    prompt: 'a clock wearing pijamas.',
    time: 45
  },
  {
    prompt: 'a large, perfect circle.',
    time: 15
  },
  {
    prompt: 'a very, very grumpy cat.',
    time: 45
  },
  {
    prompt: '"Mona Lisa".',
    time: 45
  },
  {
    prompt: 'two large squares, inside of each other',
    time: 20
  },
  {
    prompt: 'a monument to 2020.',
    time: 45
  },
  {
    prompt: 'a Jackson Pollock.',
    time: 30
  }
]

class Index extends React.Component {
  state = {
    name: null,
    prompt: 'We will collectively do a series of drawings. For now, hold on and wait for instructions...',
    timeLeft: -1,
    isAdmin: true,
    finished: false
  }
  images = []
  sessionId = 0
  paths = {}

  setupCanvas = (c) => {
    this._canvas = c
    paper.setup(this._canvas)
    paper.view.onFrame = this.draw
    paper.view.onMouseDown = this.onMouseDown
    paper.view.onMouseDrag = this.onMouseDrag
    paper.view.onMouseUp = this.onMouseUp

    this.grid = new paper.Group()
    this.drawing = new paper.Group()
    // paper.tool.maxDistance = 80
    // paper.tool.minDistance = 2
  }
  evtOutOfBounds = (event) => {
    if (this.drawingBounds) {
      if (event.point.x < this.drawingBounds.p.x) return true
      if (event.point.y < this.drawingBounds.p.y) return true
      if (event.point.x > this.drawingBounds.p.x + this.drawingBounds.s.width) return true
      if (event.point.y > this.drawingBounds.p.y + this.drawingBounds.s.height) return true
    }
    return false
  }
  onMouseDown = (event) => {
    if (this.evtOutOfBounds(event)) return
    const { timeLeft } = this.state
    if (timeLeft == 0) return
    // Create the new path
    let color = randomColor();
    this.startPath( event.point, color, this.sessionId );
    // Inform the backend
    this.emit("startPath", {point: event.point, color: color}, this.sessionId);
  }
  onMouseDrag = (event) => {
    if (this.evtOutOfBounds(event)) return
    const { timeLeft } = this.state
    if (timeLeft == 0) return

    var step        = event.delta.divide(6);
    step.angle     += 90; 
    var top         = event.point.add(step);
    var bottom      = event.point.subtract(step);
    this.continuePath( top, bottom, this.sessionId );
    this.emit("continuePath", {top: top, bottom: bottom}, this.sessionId);
  }
  onMouseUp = (event) => {
    if (this.evtOutOfBounds(event)) return
    const { timeLeft } = this.state
    if (timeLeft == 0) return

    this.endPath(event.point, this.sessionId);
    this.emit("endPath", {point: event.point}, this.sessionId);
  }

  startPath = (point, color, sessionId) => {
    this.paths[sessionId] = new paper.Path();
    this.drawing.addChild(this.paths[sessionId])
    this.paths[sessionId].fillColor = color;
    this.paths[sessionId].add(new paper.Point(point.x, point.y));
  }

  continuePath = (top, bottom, sessionId) => {
    var path = this.paths[sessionId];
    path.add(new paper.Point(top.x, top.y));
    path.insert(0, new paper.Point(bottom.x, bottom.y));
    path.smooth();
  }

  endPath = (point, sessionId) => {
    var path = this.paths[sessionId];
    path.add(new paper.Point(point.x, point.y));
    path.closed = true;
    path.smooth();
    delete this.paths[sessionId]
  }
  
  serialize = (p) => {
    return { x: p.x, y: p.y }
  }
  
  emit = (event, data) => {
    if (data.point) data.point = this.serialize(data.point)
    if (data.top) data.top = this.serialize(data.top)
    if (data.bottom) data.bottom = this.serialize(data.bottom)
    this.io.emit(event, data, this.sessionId)
  }

  updateGrid = (dataObj) => {
    this.grid.removeChildren()
    this.drawingBounds = null
    Object.values(dataObj).forEach(data => {
      let p = new paper.Point(data.bounds.x * CANVAS_WIDTH, data.bounds.y * CANVAS_HEIGHT)
      let s = new paper.Size(data.bounds.w * CANVAS_WIDTH, data.bounds.h * CANVAS_HEIGHT)
      let r = new paper.Shape.Rectangle(p, s)
      if (this.sessionId == data.socketId) {
        this.drawingBounds = { p: p.clone(), s: s.clone() }
      }
      r.strokeColor = '#FEFEA8'
      r.strokeWidth = 0.5
      
      let name = new paper.PointText()
      name.content = data.name
      name.fontSize = 12
      name.fillColor = (this.sessionId == data.socketId) ? '#FE7878' : '#FEFEA8'
      name.fontFamily = 'FoundersGrotesk'
      let tp = p.clone()
      name.position = tp.add(new paper.Point(s.width / 2, 15))
      
      this.grid.addChild(r)
      this.grid.addChild(name)
    })

    if (this.drawingBounds) {
      let currentR = new paper.Shape.Rectangle(this.drawingBounds.p, this.drawingBounds.s)
      currentR.strokeColor = '#FE7878'
      currentR.strokeWidth = 1
      this.grid.addChild(currentR)
    }
  }

  componentDidMount() {
    this.setState({
      isAdmin: (window.location.hash == '#admin')
    })
    this.io = io('/')
    this.io.on('connect', () => {      
      this.sessionId = this.io.id
      this.doCountdown()
    })
    this.io.on('startPath', ( data, sessionId ) => {
      this.startPath(data.point, data.color, sessionId);      
    })
    
    this.io.on( 'continuePath', ( data, sessionId ) => {    
      this.continuePath(data.top, data.bottom, sessionId);
      paper.view.draw();
    })
        
    this.io.on( 'endPath', ( data, sessionId ) => {    
      this.endPath(data.point, sessionId);
      paper.view.draw();      
    })

    this.io.on('state', (data) => {
      this.updateGrid(data)
    })

    this.io.on('newPrompt', (data) => {
      this.grid.opacity = 1
      this.drawing.removeChildren()
      this.setState({
        prompt: data.prompt,
        timeLeft: data.time
      }, () => {
        this.doCountdown()
      })
    })

    this.io.on('finishPrompt', () => {
      this.setState({ finished: true })
    })
  }

  doCountdown = () => {
    const { timeLeft } = this.state
    if (timeLeft == 0) {
      this.grid.opacity = 0
      setTimeout(() => {
        this.images.push({ 
          src: this._canvas.toDataURL(),
          prompt: this.state.prompt
        })  
      }, 150)
    }
    if (timeLeft <= 0) return
    setTimeout(() => {
      this.setState({ timeLeft: timeLeft - 1})
      this.doCountdown()
    }, 1000)
  }

  secondsToString = (s) => {
    if (s < 0) return '0:00'
    const sex = (s % 60 < 10) ? `0${s % 60}` : `${s % 60}`
    return `${Math.floor(s / 60)}:${sex}`
  }

  onNameClick = () => {
    const name = this._inputRef.value
    this.io.emit('name', { name, observer: this.state.isAdmin })
    this.setState({ name })
  }

  onAdminPromptClick = (data) => (evt) => {
    this.io.emit('sendNewPrompt', { prompt: data.prompt, time: data.time })
  }

  onAdminFinishClick = (evt) => {
    this.io.emit('sendFinishPrompt')
  }

  render() {
    const { name, prompt, timeLeft, isAdmin, finished } = this.state
    const stringTime = this.secondsToString(timeLeft)
    const timeCls = classnames({
      'time-left': true,
      'red': (timeLeft < 10)
    })
    return (
      <>
        { isAdmin && 
          <div className="admin-panel">
            { prompts.map(p => {
              return (
                <div className="prompt" onClick={this.onAdminPromptClick(p)}>
                  {p.prompt} – {p.time}
                </div>
              )
            })
            }
            <div className="prompt" onClick={this.onAdminFinishClick}>
              Finish!
            </div>
          </div>
        }
        {
          finished &&
          <div className="finished">
            <h1> Thank you for drawing with me! </h1>
            <br/>
            { this.images.map(o => {
              return (
                <div className="finished-item">
                  <div>{o.prompt}</div>
                  <img src={o.src} className="image"/>
                </div>
              )
            })}
          </div>
        }
        { !name && 
          <div className="name-overlay">
            <div className="prompt">
              Please enter your name<br/>
              (the real one, if you’re comfortable sharing it)
            </div>
            <div className="input">
              <input type="text" ref={r => this._inputRef = r}></input>
            </div>
            <div className="button" onClick={this.onNameClick}>
              What's next?
            </div>
          </div>
        }
        { !finished &&
          <div className="main">
            <div className="main-text">
              <div className="main-prompt">
                { (timeLeft != -1) && 'Draw' } { prompt }
              </div>
              <div className={timeCls}>
                { stringTime }
              </div>
            </div>
            <canvas id="bubble-canvas" width="1050" height="600" resize="false" keepalive="true" ref={this.setupCanvas}></canvas>
          </div>
        }
      </>
    )
  }
}

export default Index