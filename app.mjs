import express from 'express'
import next from 'next'
import bodyParser from 'body-parser'
import ioModule from 'socket.io'
import httpModule from 'http'

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = express()
  server.use(bodyParser.json())
  server.use(bodyParser.urlencoded({ extended: true }))
  var http = httpModule.Server(server)
  var io = ioModule(http)
  var port = 3000;

  if (process.env.NODE_ENV === "production") {
    server.get(
      /^\/_next\/static\//,
      (_, res, nextHandler) => {
        res.setHeader(
          "Cache-Control",
          "public, max-age=31536000, immutable",
        );
        nextHandler();
      },
    );
  }

  server.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  })

  server.get('*', (req, res, next) => {
    console.log('Request: ', req.originalUrl)
    return handle(req, res)
  })

  http.listen(port, function(){
    console.log('listening on *:', port)
  })

  // A client connected to the socket
  io.on('connection', (socket) => {
    socket.on( 'startPath', (data, sessionId ) => {
      console.log(data, sessionId)
      socket.broadcast.emit( 'startPath', data, sessionId );
    });

    // A User continues a path
    socket.on( 'continuePath', (data, sessionId ) => {
      socket.broadcast.emit( 'continuePath', data, sessionId );
    });

    // A user ends a path
    socket.on( 'endPath', (data, sessionId ) => {
      socket.broadcast.emit( 'endPath', data, sessionId );
    });  
  })

  // Get messages saved in the creatures
  server.get('/savedMessages', (req, res, next) => {
    res.send('Pula')
  })

})
