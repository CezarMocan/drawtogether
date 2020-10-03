import React from 'react'
import Style from '../static/styles/main.less'
import Head from '../components/Head'
import paper, { Point, Size } from 'paper'
import io from 'socket.io-client/dist/socket.io'

const randomColor = () => { return { hue: Math.random() * 360, saturation: 0.8, brightness: 0.8, alpha: 0.5 } }

class Index extends React.Component {
  sessionId = 0
  paths = {}

  setupCanvas = (c) => {
    this._canvas = c
    paper.setup(this._canvas)
    paper.view.onFrame = this.draw
    paper.view.onMouseDown = this.onMouseDown
    paper.view.onMouseDrag = this.onMouseDrag
    paper.view.onMouseUp = this.onMouseUp
    // paper.tool.maxDistance = 80
    // paper.tool.minDistance = 2
  }
  onMouseDown = (event) => {
    // Create the new path
    let color = randomColor();
    this.startPath( event.point, color, this.sessionId );
    // Inform the backend
    this.emit("startPath", {point: event.point, color: color}, this.sessionId);
  }
  onMouseDrag = (event) => {
    var step        = event.delta.divide(2);
    step.angle     += 90; 
    var top         = event.point.add(step);
    var bottom      = event.point.subtract(step);
    this.continuePath( top, bottom, this.sessionId );
    this.emit("continuePath", {top: top, bottom: bottom}, this.sessionId);
  }
  onMouseUp = (event) => {
    this.endPath(event.point, this.sessionId);
    this.emit("endPath", {point: event.point}, this.sessionId);
  }

  startPath = (point, color, sessionId) => {
    this.paths[sessionId] = new paper.Path();
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

  componentDidMount() {
    this.io = io('/')
    this.io.on('connect', () => {      
      this.sessionId = this.io.id
    })
    this.io.on('startPath', ( data, sessionId ) => {
      console.log('startPath: ', sessionId, data)
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
  }

  render() {
    return (
      <div>
        <h1>Test</h1>
        <canvas id="bubble-canvas" width="500" height="500" resize="false" keepalive="true" ref={this.setupCanvas}></canvas>
      </div>
    )
  }
}

export default Index