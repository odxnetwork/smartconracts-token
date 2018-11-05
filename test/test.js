const BigNumber = web3.BigNumber;
const should = require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();
const EVMThrow = 'invalid opcode';
module.exports = { should, EVMThrow };

let ODXToken = artifacts.require("./ODXToken.sol");

let odxInstance;

contract('ODXToken Contract', function (accounts) {
  const owner = accounts[0];
  const otherAccount = accounts[2];
  const anotherAccount = accounts[3];
  const from = accounts[1];
  const spender = accounts[1];
  const to = accounts[4];
  const amount = 100;
  const higherAmount = 200;
  const lowerAmount = 50;
  const amount2 = 200;
  const amount3 = 101;
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
      

  beforeEach(async function () {
    this.token = await ODXToken.new("ODX Test Token 01", "ODXT", 18, "1000000000000000000000000000", { from: accounts[0] });
  });

  //accounts[0] is the default account
  it("Contract deployment", function() {
    return ODXToken.deployed().then(function (instance) {
      odxInstance = instance;
      assert(odxInstance !== undefined, 'ODXToken contract should be defined');
    });
  });

  describe('total supply', function () {
    it('initial token supply must be zero', async function () {
      const totalSupply = await this.token.totalSupply();
      totalSupply.should.be.bignumber.equal(0);
    });
  });

  describe('balanceOf', function () {
    describe('when the requested account has no tokens', function () {
      it('returns zero', async function () {
        const balance = await this.token.balanceOf(accounts[1]);
        balance.should.be.bignumber.equal(0);
      });
    });

  });

  describe('owner', function () {
      it('returns the owner', async function () {
        const tokenOwner = await this.token.owner();
        tokenOwner.should.be.equal(owner);
      });
    
  });

  describe('setMintAgent', function () {
    it("should allow when the sender is the token owner", async function() {
      await this.token.setMintAgent(otherAccount, true,{from:owner})
      const ret = await this.token.mintAgents(otherAccount);
      ret.should.be.equal(true);
    });

    it("should reject if sender is not the token owner", async function() {
      await this.token.setMintAgent(otherAccount, true,{from:otherAccount}).should.be.rejected;
    });

  });

  describe('mint', function () {
    
    describe('when the sender is mintAgent', function () {
      describe('when the token was not finished', function () {
        it('should mint the requested amount', async function () {
          await this.token.mint(owner, amount, { owner });
          const balance = await this.token.balanceOf(owner);
          balance.should.be.bignumber.equal(amount);
        });

        it('should emit a mint finished event', async function () {
          const { logs } = await this.token.mint(owner, amount, { owner });

          assert.equal(logs.length, 2);
          assert.equal(logs[0].event, 'Mint');
          assert.equal(logs[0].args.to, owner);
          assert.equal(logs[0].args.amount, amount);
          assert.equal(logs[1].event, 'Transfer');
        });
      });

      describe('should reject if the token minting is finished', function () {
        it('reverts', async function () {
          await this.token.finishMinting({ owner });
          await this.token.mint(owner, amount, { owner }).should.be.rejected;
        });
      });
    });
    
    describe('when the sender is not a mintAgent', function () {
      it('should reject minting request', async function () {
        await this.token.mint(otherAccount, amount, { from:anotherAccount }).should.be.rejected;
        await this.token.finishMinting({ owner });
        await this.token.mint(otherAccount, amount, { from:anotherAccount }).should.be.rejected;
      });
    });
  });

  describe('transfer', function () {
    
    it('should allow if user has sufficient balance', async function () {
      await this.token.mint(from, amount, { owner })
      await this.token.transfer(to, amount, { from });
      const tobalance = await this.token.balanceOf(to);
      tobalance.should.be.bignumber.equal(amount);
      const frombalance = await this.token.balanceOf(from);
      frombalance.should.be.bignumber.equal(0);
    });

    it('should reject if user has insufficient balance', async function () {
      await this.token.mint(from, amount, { owner });
      await this.token.transfer(to, higherAmount, { from }).should.be.rejected;
    });
    
    it('should reject if transferring to an invalid address', async function () {
      await this.token.mint(from, amount, { owner });
      await this.token.transfer(ZERO_ADDRESS, higherAmount, { from }).should.be.rejected;
    });

    it('should log token transfer', async function () {
      await this.token.mint(anotherAccount, amount, { from:owner });
      const { logs } = await this.token.transfer(otherAccount, amount, { from:anotherAccount });
      const event = logs.find(e => e.event === 'Transfer');
      should.exist(event);
      event.args.from.should.equal(anotherAccount);
      event.args.to.should.equal(otherAccount);
      event.args.value.should.be.bignumber.equal(amount);
    });
  });

  describe('transferFrom', function () {
    
    describe('when the recipient is not the zero address', function () {
      describe('when the spender has enough approved balance', function () {
        beforeEach(async function () {
          await this.token.mint(owner, 100, { from: owner });
          await this.token.approve(spender, 100, { from: owner });
        });

        describe('when the owner has enough balance', function () {
          it('should allow transfer and decrease the spender allowance', async function () {
            await this.token.transferFrom(owner, to, amount, { from: spender });
            const senderBalance = await this.token.balanceOf(owner);
            senderBalance.should.be.bignumber.equal(0);
            const recipientBalance = await this.token.balanceOf(to);
            recipientBalance.should.be.bignumber.equal(amount);
          });
          
          it('should emit a transfer event', async function () {
            const { logs } = await this.token.transferFrom(owner, to, amount, { from: spender });

            assert.equal(logs.length, 1);
            assert.equal(logs[0].event, 'Transfer');
            assert.equal(logs[0].args.from, owner);
            assert.equal(logs[0].args.to, to);
            assert(logs[0].args.value.eq(amount));
          });
        });

        describe('when the owner does not have enough balance', function () {
          it('reverts', async function () {
            await this.token.transferFrom(owner, to, higherAmount, { from: spender }).should.be.rejected;
          });
        });
      });

      describe('when the spender does not have enough approved balance', function () {
        beforeEach(async function () {
          await this.token.approve(spender, lowerAmount, { from: owner });
          await this.token.mint(owner, amount, { from: owner });
        });

        describe('when the owner has enough balance', function () {
          it('reverts', async function () {
            await this.token.transferFrom(owner, to, amount, { from: spender }).should.be.rejected;
          });
        });

        describe('when the owner does not have enough balance', function () {
          it('reverts', async function () {
            await this.token.transferFrom(owner, to, higherAmount, { from: spender }).should.be.rejected;
          });
        });
      });
    });

    describe('when the recipient is the zero address', function () {
      beforeEach(async function () {
        await this.token.approve(spender, amount, { from: owner });
        await this.token.mint(owner, 100, { from: owner });
      });

      it('reverts', async function () {
        const errMsg = "ERROR : cannot transfer to address zero";
        return this.token.transferFrom(owner, ZERO_ADDRESS, amount, { from: spender })
        .then(function (instance) {
          throw(errMsg);
        }).catch(function (e) {
          if(e === errMsg) {
            assert(false);
          } else {
            assert(true);
          }
        })
      });
    });
  });

  describe('transferOwnership', function () {
    
    it("when the sender is the token owner", async function() {
      await this.token.transferOwnership(otherAccount, { owner });
      const ret = await this.token.owner();
      assert.equal(ret, otherAccount);
    });
    
    
    it('should prevent non-owners from transfering', async function () {
      assert.isTrue(owner !== otherAccount);
      const errMsg = "ERROR : Only the owner can call transferOwnership";
      return this.token.transferOwnership(otherAccount, { from:otherAccount })
      .then(function (instance) {
        throw(errMsg);
      }).catch(function (e) {
        if(e === errMsg) {
          assert(false);
        } else {
          assert(true);
        }
      });
    });

    it('should guard ownership against stuck state', async function () {
      const errMsg = "ERROR : transferring to a null address";
      return this.token.transferOwnership(null, { from:owner })
      .then(function (instance) {
        throw(errMsg);
      }).catch(function (e) {
        if(e === errMsg) {
          assert(false);
        } else {
          assert(true);
        }
      });
    });

  });

  describe('burn', function () {
    
    it('should allow if user has sufficient token', async function () {
      await this.token.mint(otherAccount, amount, { from:owner });
      await this.token.burn(amount, { from:otherAccount }).should.be.fulfilled;
      const balance = await this.token.balanceOf(otherAccount);
      balance.should.be.bignumber.equal(0);
    })


    it('should reject if user has insufficient token', async function () {
      await this.token.mint(otherAccount, amount, { owner });
      await this.token.burn(higherAmount, { otherAccount }).should.be.rejected;
    }) 

  });

  describe('burnFrom', function () {
    describe('Sufficient tokens', function () {
      describe('Caller is not allowed to burn', function () {
        it('reverts', async function () {
          await this.token.mint(owner, amount, { from: owner });
          await this.token.burnFrom(owner, amount, { from: anotherAccount }).should.be.rejected;
          const balanceAfterBurn = await this.token.balanceOf(owner);
          balanceAfterBurn.should.be.bignumber.equal(amount);
        });

      });

      describe('Caller is allowed to burn', function () {
        it('should allow burning and decreases token balance and total supply', async function () {
          await this.token.mint(otherAccount, amount, { from: owner });
          await this.token.approve(anotherAccount, amount, { from: otherAccount });
          await this.token.burnFrom(otherAccount, amount, { from: anotherAccount });
          
          const balanceAfterBurn = await this.token.balanceOf(otherAccount);
          balanceAfterBurn.should.be.bignumber.equal(0);
          const totalSupplyAfterBurn = await this.token.totalSupply();
          totalSupplyAfterBurn.should.be.bignumber.equal(0);
        });
      });
    });
    describe('Insufficient tokens', function () {
      describe('Caller is not allowed to burn', function () {
        it('reverts', async function () {
          await this.token.mint(owner, amount, { from: owner });
          await this.token.burnFrom(owner, higherAmount, { from: anotherAccount }).should.be.rejected;
        });
      });

      describe('Caller is allowed to burn', function () {
        it('reverts', async function () {
          await this.token.mint(owner, amount, { from: owner });
          await this.token.approve(otherAccount, amount, { from: owner });
          await this.token.burnFrom(owner, higherAmount, { from: otherAccount }).should.be.rejected;
        });

      });
      
    });
  });
  
  describe('stop/start', function () {
    describe('called by non-owner', function () {
      it('reverts', async function () {
        await this.token.stop({ from: otherAccount }).should.be.rejected;
        await this.token.start({ from: otherAccount }).should.be.rejected;
      });
    });
    describe('called owner', function () {
      it('reverts', async function () {
        await this.token.stop({ from: owner });
        await this.token.mint(otherAccount, amount, { from: owner }).should.be.rejected;
        await this.token.start({ from: owner });
        await this.token.mint(otherAccount, amount, { from: owner });
      });
    });
    describe('reject transfer', function () {
      it('reverts', async function () {
        await this.token.mint(otherAccount, amount, { from: owner });
        await this.token.stop({ from: owner });
        await this.token.transfer(anotherAccount, amount, { from:otherAccount }).should.be.rejected;
        await this.token.start({ from: owner });
        await this.token.transfer(anotherAccount, amount, { from:otherAccount });
      });
    });
  });

});
