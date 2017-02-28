import {
  graphql,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLList,
  GraphQLNonNull
} from 'graphql'
import arangojs, { aql } from 'arangojs'



describe('graphql', () => {

  describe('hello', () => {

    it('returns world', async () => {

      let RootQueryType = new GraphQLObjectType({
	name: 'RootQueryType',
	fields: () => ({
	  hello: {
	    type: GraphQLString,
	    resolve: () => {
	      return 'world'
	    },
	  }
	})
      })

      let schema = new GraphQLSchema({ query: RootQueryType })


      let query = ` { hello } `

      let { data } = await graphql(schema, query)
      expect(data).toEqual({hello: 'world'})
    })

  })

  describe('hello with args', () => {


    it('returns adjective + world', async () => {

      let schema = new GraphQLSchema({
	query: new GraphQLObjectType({
	  name: 'Query',
	  fields: () => ({
	    hello: {
	      args: {
		adjective: { type: GraphQLString }
	      },
	      type: GraphQLString,
	      resolve: (root, args) => {
		return args.adjective + ' world'
	      }
	    }
	  })
	})
      })

      let query = ` { hello(adjective: "beautiful") } `

      let { data } = await graphql(schema, query)
      expect(data).toEqual({hello: 'beautiful world'})
    })

  })

  describe('using a type with a hardcoded return value', () => {

    let Person = new GraphQLObjectType({
      name: 'Person',
      fields: () => ({
	name: {
	  type: GraphQLString
	}
      })
    })

   let schema = new GraphQLSchema({
      query: new GraphQLObjectType({
	name: 'Query',
	fields: () => ({
	  person: {
	    type: Person,
	    resolve: () => {
	      return {name: 'Mike'}
	    },
	  }
	})
      })
    })

    it('lets you ask for a person', async () => {

      let query = `
      query {
	person {
	  name
	}
      }
    `;

      let { data } = await graphql(schema, query)
      expect(data.person).toEqual({name: 'Mike'})
    })

  })

  describe('requesting a person from the database', () => {

    let db = arangojs({
      url: `http://ottawa_graph:graph@127.0.0.1:8529`,
      databaseName: 'ottawa_graph'
    })

    async function getPersonByName (name) {
      let query = aql`
	  FOR person IN persons
	    FILTER person.name == ${ name }
              LIMIT 1
	      RETURN person
	`
      let results = await db.query(query)
      return results.next()
    }

    async function getFriends (id) {
      let query = aql`
	  FOR vertex IN OUTBOUND ${id} knows
	    RETURN vertex
	`
      let results = await db.query(query)
      return results.all()
    }

    it('can talk to arangodb', async () => {
      let person = await getPersonByName('Eve')
      console.log(person)
      expect(person.name).toEqual("Eve")
    })

    it('lets you ask for a person from the database', async () => {

      let Person = new GraphQLObjectType({
	name: 'Person',
	fields: () => ({
	  name: {
	    type: GraphQLString
	  }
	})
      })

      let schema = new GraphQLSchema({
	query: new GraphQLObjectType({
	  name: 'Query',
	  fields: () => ({
	    person: {
	      type: Person,
	      resolve: async () => {
		return getPersonByName('Eve')
	      },
	    }
	  })
	})
      })

      let query = `
	query {
	  person {
	    name
	  }
	}
      `

      let result = await graphql(schema, query)
      expect(result.data.person).toEqual({name: 'Eve'})
    })

    it('returns friends', async () => {

      let Person = new GraphQLObjectType({
	name: 'Person',
	fields: () => ({
	  name: {
	    type: GraphQLString
	  },
	  friends: {
	    type: new GraphQLList(Person),
	    resolve(root) {
	      return getFriends(root._id)
	    }
	  }
	})
      })

      let schema = new GraphQLSchema({
	query: new GraphQLObjectType({
	  name: 'Query',
	  fields: () => ({
	    person: {
	      args: {
		name: {
		  type: new GraphQLNonNull(GraphQLString)
		}
	      },
	      type: Person,
	      resolve: (root, args) => {
		return getPersonByName(args.name)
	      },
	    }
	  })
	})
      })

      let query = `
	query {
	  person(name: "Eve") {
	    name
	    friends {
	      name
	    }
	  }
	}
      `

      let result = await graphql(schema, query)
      console.log(result)
      expect(result.data.person.friends[0]).toEqual({name: 'Bob'})
    })

    it('returns friends of friends', async () => {

      let Person = new GraphQLObjectType({
	name: 'Person',
	fields: () => ({
	  name: {
	    type: GraphQLString
	  },
	  friends: {
	    type: new GraphQLList(Person),
	    resolve(root) {
	      return getFriends(root._id)
	    }
	  }
	})
      })

      let schema = new GraphQLSchema({
	query: new GraphQLObjectType({
	  name: 'Query',
	  fields: () => ({
	    person: {
	      args: {
		name: {
		  type: new GraphQLNonNull(GraphQLString)
		}
	      },
	      type: Person,
	      resolve: (root, args) => {
		return getPersonByName(args.name)
	      },
	    }
	  })
	})
      })

      let query = `
	query {
	  person(name: "Eve") {
	    name
	    friends {
	      name
	      friends {
	        name
	      }
	    }
	  }
	}
      `

      let result = await graphql(schema, query)
      console.log(JSON.stringify(result))
      expect(result.data.person.friends[0].friends[0]).toEqual({name: 'Charlie'})
    })

  })

})
