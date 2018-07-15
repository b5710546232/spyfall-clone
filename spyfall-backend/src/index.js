import Express from 'express'
import Http from 'http'
import Socket from 'socket.io'
import ShortID from 'shortid'
import Moment from 'moment'
import Lodash from 'lodash'

import GAMESTATES from './constants/gameStates'
import Locationlist from './constants/locations'
import Player from './player'

import { getRandomInt } from './utils'
const app = Express()
const server = Http.createServer(app)

const PORT = process.env.PORT || 8000
const io = Socket(server)

let roomList = []
ShortID.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ@$')

io.on('connection', socket => {
  console.log('connect')
  socket.on('create', data => {
    let roomID = ShortID.generate()
    while(roomID.includes('@') || roomID.includes('$')){
      console.log('roomID:',roomID,' >> regenerate.')
      roomID = ShortID.generate()
    }
    createRoom(roomID)
    joinRoom(roomID, socket.id, data.playerName, socket)
    console.log('room' , roomID, 'created by', data.playerName)
    socket.emit('room', getRoomData(roomID))
  })
  socket.on('join', data => {
    console.log(data.playerName, ' join to ', data.roomID)
    joinRoom(data.roomID, socket.id, data.playerName, socket)
    io.emit('room', getRoomData(data.roomID))
  })
  socket.on('ready', data => {
    let checkReady = checkGameIsReady(data.roomID, socket.id)
    if (checkReady) {
      assignLocationToRoom(data.roomID)
      startGame(data.roomID)
    }
    io.emit('room', getRoomData(data.roomID))
  })
  socket.on('vote', data => {
    let room = Lodash.find(roomList, room => room.roomID === data.roomID)
    if(!room) return
    let player = Lodash.find(room.playerList, p => p.playerID === data.votedPlayerID)
    if (!player) return
    player.voteCounter=player.voteCounter+1
    
    Lodash.map(room.playerList, p => {
      p.socket.emit('room', getRoomData(room.roomID))
    })
    
  })
})

const assignLocationToRoom = roomID => {
  let room = Lodash.find(roomList, room => room.roomID === roomID)
  let locationAndRole = getRandomLocationAndRole()
  let location = locationAndRole.Location
}

const getRandomLocationAndRole = () => {
  let randInt = getRandomInt(Locationlist.length)
  return Locationlist[randInt]
}

const getRandomRole = roles => {
  let randInt = getRandomInt(roles.length)
  return roles[randInt]
}

const createRoom = roomID => {
  var room = {
    roomID: roomID,
    gameState: GAMESTATES.WAITING,
    playerList: [],
    curentTime: '',
    endTime: ''
  }
  roomList.push(room)
}

const startGame = roomID => {
  let room = Lodash.find(roomList, room => room.roomID === roomID)
  room.gameState = GAMESTATES.PLAYING
  let TimelengthInMinute = 1/12
  room.curentTime = Moment()
  room.endTime = Moment().add(TimelengthInMinute, 'minutes')
  let interval = setInterval(() => {
    if (Moment() >= room.endTime) {
      room.gameState = GAMESTATES.VOTING
      
      Lodash.map(room.playerList, p => {
        p.socket.emit('room', getRoomData(roomID))
      })
      clearInterval(interval)

    } else {
      room.curentTime = Moment() // update time
      Lodash.map(room.playerList, p => {
        p.socket.emit('room', getRoomData(roomID))
      })
    }
  }, 900)
}


const checkGameIsReady = (roomID, playerID) => {
  let room = Lodash.find(roomList, room => room.roomID === roomID)
  if (!room) return
  let player = Lodash.find(room.playerList, p => p.playerID === playerID)
  if (!player) return
  player.isReady = true
  return room.playerList.length === Lodash.filter(room.playerList, p => p.isReady === true).length
}

const joinRoom = (roomID, playerID, playerName, socket) => {
  let room = Lodash.find(roomList, room => room.roomID === roomID)
  if (!room) return
  let player = new Player(playerID, playerName, socket)
  room.playerList.push(player)
}

const getPlayerListByRoomID = roomID => {
  let room = Lodash.find(roomList, room => room.roomID === roomID)
  if (!room) return null
  return room.playerList.map(p => p.getData())
}

const getRoomData = roomID => {
  let room = Lodash.find(roomList, room => room.roomID === roomID)
  return {
    roomID: roomID,
    gameState: room.gameState,
    playerList: getPlayerListByRoomID(roomID),
    curentTime: room.curentTime,
    endTime: room.endTime
  }
}

server.listen(PORT, () => {
  console.log(`server is on port ${PORT}`)
})
